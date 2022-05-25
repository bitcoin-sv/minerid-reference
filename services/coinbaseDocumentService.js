const bsv = require('bsv')
const request = require('request-promise')
const config = require('config')
const fm = require('../utils/filemanager')
const bitcoin = require('bitcoin-promise')
const { addExtensions, placeholderCB1 } = require('./extensions')

// for mainnet: "livenet"
// for testnet: "testnet"
// for regtest: "testnet"
const network = config.get('network')
let networkName
switch (network) {
  case 'livenet':
    networkName = 'main'
    break

  case 'testnet':
  case 'regtest':
    networkName = 'test'
    break

  default:
    console.log('Network configuration not properly set in config.json file')
    break
}

const vcTxFilename = 'vctx'
const cbdVersion = '0.2'
const fee = 300
const dustLimit = 546 // satoshis
const protocolName = '601dface'

function generateMinerId (aliasName) {
  // the first alias has an underscore 1 appended so other aliases increment
  const alias = aliasName + '_1'
  try {
    // Check if aliasName is unused.
    const existsMinerId = fm.getMinerId(alias)
    if (existsMinerId) {
      console.log(`miner alias "${aliasName}" already exists: `)
      console.log(existsMinerId)
      console.log('Please choose another one.')
      return false
    }
    const existsRevocationKey = fm.getRevocationKeyPublicKey(alias)
    if (existsRevocationKey) {
      console.log(`miner alias "${aliasName}" is linked to the existing revocationKey: `)
      console.log(existsRevocationKey)
      console.log('Please choose another one.')
      return false
    }

    // Create minerId key.
    fm.createMinerId(alias)
    const minerId = fm.getMinerId(alias)
    console.log('Generated new minerId: ', minerId)
    // Create revocationKey key.
    fm.createRevocationKey(alias)
    const revocationKeyPublicKey = fm.getRevocationKeyPublicKey(alias)
    console.log('Generated new revocationKey: ', revocationKeyPublicKey)
    // Save the current alias.
    fm.saveAlias(aliasName, alias)
  } catch (err) {
    console.log('Please check that the signing_service is running properly...')
    console.log('generateMinerId error: ', err)
    return false
  }
  return true
}

function getCurrentMinerId (alias) {
  const currentMinerId = fm.getMinerId(fm.getCurrentAlias(alias))
  return currentMinerId
}

function signWithCurrentMinerId (hash, alias) {
  const currentAlias = fm.getCurrentAlias(alias)

  if (currentAlias === null) {
    return
  }
  return signHash(Buffer.from(hash, 'hex'), currentAlias)
}

function sign (payload, alias) {
  if (typeof payload === 'string') {
    payload = Buffer.from(payload, 'hex')
  }

  const hash = bsv.crypto.Hash.sha256(payload)

  return signHash(hash, alias)
}

function signHash (hash, alias) {
  const privateKey = fm.getPrivateKey(alias)

  const signature = bsv.crypto.ECDSA.sign(hash, privateKey)
  return signature.toString('hex')
}

async function getValididyCheckTx (aliasName, vctPrivKey) {
  let vctx = fm.getVctxFromFile(aliasName)
  if (!vctx) {
    // no vctx so create one
    vctx = await createValidityCheckTx(vctPrivKey, aliasName)
    if (!vctx) {
      console.log('Error: Could not create vctx')
      return
    }
    // save to file
    fm.writeVctxToFile(aliasName, vctx)
  }

  return vctx
}

// we create a validity check transaction. It only has one output.
async function createValidityCheckTx (vctPrivKey, aliasName) {
  const vcTxAddress = bsv.Address.fromPrivateKey(vctPrivKey, network)
  // Now we have decide how to fund it.
  if (network === 'regtest') {
    try {
      let vctx = fm.getVctxFromFile(aliasName)
      if (!vctx) {
        const bitcoinClient = new bitcoin.Client({
          host: config.get('bitcoin.rpcHost'),
          port: config.get('bitcoin.rpcPort'),
          user: config.get('bitcoin.rpcUser'),
          pass: config.get('bitcoin.rpcPassword'),
          timeout: 10000
        })

        vctx = await bitcoinClient.sendToAddress(vcTxAddress.toString(), 1)
        const blockHash = await bitcoinClient.generate(1)
        console.log(`New block mined with hash: ${blockHash}`)
        console.log('VCTx transaction ID:', vctx)
      }

      return vctx
    } catch (err) {
      console.log('Connection to regtest ERROR!')
      console.log('Please check that there is a proper connection to regtest node')
      console.log('and the node has sufficient funds (generate 101)\n')
      throw err
    }
  }

  let utxos
  try {
    utxos = await getUtxos(vcTxAddress.toString(), networkName)
  } catch (err) {
    console.log(`Error: Get utxos error for ${vcTxAddress}: ` + err)
  }

  if (!utxos || utxos.length === 0) {
    console.log('Please fund the validity check transaction address then run the command again. Be aware that the total amount you send will remain unspent as long as your minerId remains valid.')
    console.log('Address to fund: ', vcTxAddress.toString())
    return
  }

  const utxoAmount = utxos.reduce((acc, curr) => { return acc + curr.satoshis }, 0)
  console.log('Validity Check Transaction Amount ', utxoAmount)
  if (utxoAmount < dustLimit) {
    console.log(`You only have ${utxoAmount} satoshis in your validity check tx address. This is below the dust limit.`)
    console.log('Please fund the validity check transaction address then run the command again. Be aware that the total amount you send will remain unspent as long as your minerId remains valid.', vcTxAddress.toString())
    return
  }

  const tx = new bsv.Transaction()
    .from(utxos)
    .to(vcTxAddress, utxoAmount - fee)
    .fee(fee)

  tx.sign(vctPrivKey)

  try {
    const vctxid = await sendTX(tx.toString())
    console.log('VCTx transaction ID:', vctxid)
    return vctxid
  } catch (e) {
    console.log('error sending tx: ', e.message)
  }
}

async function getUtxos (address, network) {
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    },
    uri: `https://api.mattercloud.net/api/v3/${network}/address/${address}/utxo`,
    timeout: 5000
  }

  try {
    const utxosRes = await request(options)
    const utxos = JSON.parse(utxosRes)

    // Sort these in descending order of confirmation (oldest first)...
    utxos.sort((a, b) => b.confirmations - a.confirmations)

    const spendableUtxos = []

    for (let i = 0; i < utxos.length; i++) {
      const include = true
      if (include) {
        spendableUtxos.push(
          new bsv.Transaction.UnspentOutput({
            address: utxos[i].address,
            script: bsv.Script(utxos[i].script),
            satoshis: utxos[i].satoshis,
            outputIndex: utxos[i].outputIndex,
            txid: utxos[i].txid
          })
        )
      }
    }

    return spendableUtxos
  } catch (err) {
    console.log('ERROR: ' + err)
    throw err
  }
}

async function sendTX (hex) {
  const uri = `https://api.whatsonchain.com/v1/bsv/${networkName}/tx/raw`

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    uri: uri,
    body: {
      txhex: hex
    },
    json: true
  }

  try {
    const response = await request(options)
    return response
  } catch (err) {
    console.log('ERROR: ' + err)
    throw err
  }
}

function getOrCreateVctPk (aliasName) {
  return fm.getOrCreatePrivKey(aliasName, vcTxFilename)
}

function createCoinbaseOpReturn (doc, sig) {
  doc = Buffer.from(doc).toString('hex')
  return bsv.Script.buildSafeDataOut([protocolName, doc, sig], 'hex')
}

async function generateVcTx (aliasName) {
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }

  const vctPrivKey = getOrCreateVctPk(aliasName)

  const vct = await getValididyCheckTx(aliasName, vctPrivKey)
  return vct
}

/* Create a new minerId
   Don't return anything but the subsequent coinbase documents will contain both minerIds (now including the new one)
*/
function rotateMinerId (aliasName) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  try {
    // console.log('Rotating minerId')

    // get current alias
    const currentAlias = fm.getCurrentAlias(aliasName)
    const aliasParts = currentAlias.split('_')
    // increment alias prefix
    let nr = aliasParts.pop()
    aliasParts.push(++nr)
    const newAlias = aliasParts.join('_')
    // save alias
    fm.saveAlias(aliasName, newAlias)
    // get minerId
    fm.createMinerId(newAlias)
  } catch (err) {
    console.log('error rotating minerId: ', err)
  }
}

function createCoinbaseDocument (aliasName, height, minerId, prevMinerId, vcTx) {
  prevMinerId = prevMinerId || minerId

  const minerIdSigPayload = Buffer.concat([
    Buffer.from(prevMinerId, 'hex'),
    Buffer.from(minerId, 'hex'),
    Buffer.from(vcTx, 'hex')
  ])

  const prevMinerIdSig = sign(minerIdSigPayload, fm.getPreviousAlias(aliasName))

  const optionalData = fm.getOptionalMinerData(aliasName)
  const doc = {
    version: cbdVersion,
    height: height,

    prevMinerId: prevMinerId,
    prevMinerIdSig: prevMinerIdSig,

    minerId: minerId,

    vctx: {
      txId: vcTx,
      vout: 0
    }
  }

  if (optionalData) {
    doc.minerContact = optionalData
  }

  return doc
}

async function createMinerIdOpReturn (height, aliasName) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  if (height < 1) {
    console.log('Must enter a valid height')
    return
  }

  const vctx = await generateVcTx(aliasName)
  if (!vctx) {
    return
  }

  const minerId = getCurrentMinerId(aliasName)
  const prevMinerId = fm.getMinerId(fm.getPreviousAlias(aliasName))

  const doc = createCoinbaseDocument(aliasName, parseInt(height), minerId, prevMinerId, vctx)

  const payload = JSON.stringify(doc)

  const signature = sign(Buffer.from(payload), fm.getCurrentAlias(aliasName))

  const opReturnScript = createCoinbaseOpReturn(payload, signature).toHex()
  return opReturnScript
}

async function createCoinbase2 (height, aliasName, coinbase2, jobData) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  if (height < 1) {
    console.log('Must enter a valid height')
    return
  }

  const vctx = await generateVcTx(aliasName)
  if (!vctx) {
    return
  }

  const minerId = getCurrentMinerId(aliasName)
  const prevMinerId = fm.getMinerId(fm.getPreviousAlias(aliasName))

  const doc = createCoinbaseDocument(aliasName, parseInt(height), minerId, prevMinerId, vctx)

  addExtensions(doc, coinbase2, jobData)

  const payload = JSON.stringify(doc)

  const signature = sign(Buffer.from(payload), fm.getCurrentAlias(aliasName))

  if (!Buffer.isBuffer(coinbase2)) {
    coinbase2 = Buffer.from(coinbase2, 'hex')
  }

  const cb = Buffer.concat([Buffer.from(placeholderCB1, 'hex'), coinbase2])
  const tx = new bsv.Transaction(cb)

  tx.addOutput(new bsv.Transaction.Output({
    script: createCoinbaseOpReturn(payload, signature),
    satoshis: 0
  }))

  // Now we only want to return coinbase2 so remove first part of the coinbase (cb1)
  return tx.toString().substring(placeholderCB1.length)
}

module.exports = {
  createNewCoinbase2: createCoinbase2,
  createMinerIdOpReturn,
  generateMinerId,
  generateVcTx,
  rotateMinerId,
  getCurrentMinerId,
  signWithCurrentMinerId
}
