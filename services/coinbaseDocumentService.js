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

const cbdVersion = '0.3'
const protocolName = '601dface'
const protocolIdVersion = 0

function generateMinerId (aliasName) {
  // the first alias has an underscore 1 appended so other aliases increment
  const alias = aliasName + '_1'
  try {
    // Check if aliasName is unused.
    const existsMinerId = fm.getMinerIdPublicKey(alias)
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
    const minerId = fm.getMinerIdPublicKey(alias)
    console.log('Generated new minerId: ', minerId)
    // Create revocationKey key.
    fm.createRevocationKey(alias)
    const revocationKeyPublicKey = fm.getRevocationKeyPublicKey(alias)
    console.log('Generated new revocationKey: ', revocationKeyPublicKey)
    // Save the current MinerId alias.
    fm.saveMinerIdAlias(aliasName, alias)
    // Save the current Revocation Key alias.
    fm.saveRevocationKeyAlias(aliasName, alias)
  } catch (err) {
    console.log('Please check that the signing_service is running properly...')
    console.log('generateMinerId error: ', err)
    return false
  }
  return true
}

function getCurrentMinerId (alias) {
  const currentMinerId = fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias(alias))
  return currentMinerId
}

function signWithCurrentMinerId (hash, alias) {
  const currentAlias = fm.getCurrentMinerIdAlias(alias)

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

function createCoinbaseOpReturnScript (minerInfoTxId) {
  return bsv.Script.buildSafeDataOut([protocolName, protocolIdVersion.toString(16), minerInfoTxId], 'hex')
}

function createMinerInfoOpReturnScript (doc, sig) {
  doc = Buffer.from(doc).toString('hex')
  return bsv.Script.buildSafeDataOut([protocolName, protocolIdVersion.toString(16), doc, sig], 'hex')
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
    const currentAlias = fm.getCurrentMinerIdAlias(aliasName)
    // increment alias prefix
    const newAlias = fm.incrementAliasPrefix(currentAlias)
    // save alias
    fm.saveMinerIdAlias(aliasName, newAlias)
    // get minerId
    fm.createMinerId(newAlias)
  } catch (err) {
    console.log('error rotating minerId: ', err)
  }
}

// Rotate the current revocation key.
function rotateRevocationKey (aliasName) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return false
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return false
  }
  try {
    // get current alias
    const currentAlias = fm.getCurrentRevocationKeyAlias(aliasName)
    if (!currentAlias) {
      console.log(`Error: The revocation key alias "${aliasName}" doesn't exist.`)
      return false
    }
    // Check if the current revocation key is present in the revocation key store.
    if (!fm.revocationKeyExists(currentAlias)) {
      console.log(`Error: The "${currentAlias}.key" revocation private key is not available in the key store.`)
      return false
    }
    // increment alias prefix
    const newAlias = fm.incrementAliasPrefix(currentAlias)
    // save alias
    fm.saveRevocationKeyAlias(aliasName, newAlias)
    // create a new revocation key
    fm.createRevocationKey(newAlias)
  } catch (err) {
    console.log('Error rotating revocation key: ', err)
    return false
  }
  return true
}

function createMinerInfoDocument (aliasName, height) {
  const minerId = fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias(aliasName))
  const prevMinerId = fm.getMinerIdPublicKey(fm.getPreviousMinerIdAlias(aliasName))

  const prevRevocationKey = fm.readPrevRevocationKeyPublicKeyFromFile(aliasName)
  const revocationKey = fm.readRevocationKeyPublicKeyFromFile(aliasName)

  const minerIdSigPayload = Buffer.concat([
    Buffer.from(prevMinerId, 'hex'),
    Buffer.from(minerId, 'hex')
  ])

  const prevMinerIdSig = sign(minerIdSigPayload, fm.getPreviousMinerIdAlias(aliasName))

  const prevRevocationKeySig = fm.readPrevRevocationKeySigFromFile(aliasName)

  const optionalData = fm.getOptionalMinerData(aliasName)

  let doc = {
    version: cbdVersion,
    height: height,

    prevMinerId: prevMinerId,
    prevMinerIdSig: prevMinerIdSig,

    minerId: minerId,

    prevRevocationKey: prevRevocationKey,
    revocationKey: revocationKey,
    prevRevocationKeySig: prevRevocationKeySig
  }

  if (optionalData) {
    doc = { ...doc, ...optionalData}
  }

  return doc
}

async function createMinerInfoOpReturn (height, aliasName) {
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

  const doc = createMinerInfoDocument(aliasName, parseInt(height))
  console.debug('Miner-info doc:\n' + JSON.stringify(doc))

  const payload = JSON.stringify(doc)
  const signature = sign(Buffer.from(payload), fm.getCurrentMinerIdAlias(aliasName))
  console.debug('Miner-info-doc sig:\n' + signature.toString('hex'))

  const opReturnScript = createMinerInfoOpReturnScript(payload, signature).toHex()
  return opReturnScript
}

async function createCoinbase2 (aliasName, minerInfoTxId, coinbase2) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  if (!minerInfoTxId || !/^[A-F0-9]{64}$/i.test(minerInfoTxId)) {
    console.log('Must supply a valid TxId: ' + minerInfoTxId)
    return
  }
  console.debug('Miner-info-txid:\n' + minerInfoTxId)

  if (!Buffer.isBuffer(coinbase2)) {
    coinbase2 = Buffer.from(coinbase2, 'hex')
  }

  const cb = Buffer.concat([Buffer.from(placeholderCB1, 'hex'), coinbase2])
  const tx = new bsv.Transaction(cb)

  tx.addOutput(new bsv.Transaction.Output({
    script: createCoinbaseOpReturnScript(minerInfoTxId),
    satoshis: 0
  }))

  // Now we only want to return coinbase2 so remove first part of the coinbase (cb1)
  return tx.toString().substring(placeholderCB1.length)
}

module.exports = {
  createNewCoinbase2: createCoinbase2,
  createMinerInfoOpReturn,
  generateMinerId,
  rotateMinerId,
  rotateRevocationKey,
  getCurrentMinerId,
  signWithCurrentMinerId
}
