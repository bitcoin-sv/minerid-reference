/**
 * This test aims to verify a basic communication between the Script, Miner ID Generator & Node.
 *
 * The testing script performs the following operations:
 * 1. Calls the Miner ID Generator to create a new miner-info output script for the given block height.
 * 2. Calls the Node to create a new miner-info tx containing the output script from the point 1.
 * 3. Calls the Node to get a mining candidate.
 * 4. Creates a coinbase transaction.
 * 5. Calls the Miner ID Generator to update the coinbase2 part of the coinbase tx.
 * 6. Updates the coinbase tx and prints out its raw representation.
 *
 * Prerequisities:
 * 1. BSV Node: Set up and run a node connected to the regtest (see config/default.json configuration file).
 *   (a) Add 'standalone=1' to bitcoin.conf.
 *   (b) Make sure that funds to spend are available (generate 101)
 * 2. Miner ID Generator: Set up and run the web server (npm start).
 *   (a) create a new 'testMiner' alias via CLI interface (npm run cli -- generateminerid --name testMiner)
 *   (b) change the default port to 9003 and disable authentication
 *       (export NODE_CONFIG='{"port": 9003, "authentication": {"enabled": false}}')
 *
 * Note: To run the test use: 'node examples/testMiner.js'
 */
const bsv = require('bsv')
const config = require('config')
const rp = require('request-promise')

const { placeholderCB1 } = require('../utils/minerinfo')
const { RPCClient } = require("@iangregsondev/rpc-bitcoin")

// Generator's configuration. 
const network = config.get('network')
ALIAS = 'testMiner'
PORT_NUMBER = 9003

/**
 * Generator's Web API used in the test.
 */
async function executeRequest(requestOptions) {
  const res = await rp(requestOptions)
  if (res.statusCode === 200) {
    return res.body
  } else {
    throw new Error(`Status code: ${res.statusCode}`)
  }
}

async function getMinerInfoOutputScript (alias, height) {
  const requestOptions = {
    method: 'GET',
    uri: `http://localhost:${PORT_NUMBER}/opreturn/${alias}/${height}`,
    resolveWithFullResponse: true
  }
  return await executeRequest(requestOptions)
}

async function modifyCoinbase2 (alias, minerInfoTxId, prevhash, merkleProof, coinbase2) {
  const requestOptions = {
    method: 'POST',
    uri: `http://localhost:${PORT_NUMBER}/coinbase2`,
    json: true,
    body: {
        alias: alias,
	minerInfoTxId: minerInfoTxId,
	prevhash: prevhash,
	merkleProof: merkleProof,
	coinbase2: `${coinbase2}`
    },
    resolveWithFullResponse: true
  }
  return await executeRequest(requestOptions)
}

/**
 * Utility functions used in the test.
 */
function makeCoinbaseTx() {
  // Create a random private key and address...
  const privateKey = new bsv.PrivateKey.fromRandom()
  const publicKey = new bsv.PublicKey.fromPrivateKey(privateKey)
  const address = new bsv.Address.fromPublicKey(publicKey)
  // Create a standard coinbase TX
  const coinbaseInput = new bsv.Transaction.Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xFFFFFFFF,
    script: new bsv.Script()
  })
  return new bsv.Transaction()
    .uncheckedAddInput(coinbaseInput)
    .to(address, 1250000000)
}

function getCoinbase2(tx) {
  return Buffer.from(tx.toString().substring(84)) // the coinbase2 part starts at the index 84
}

function createTxOutput(minerInfoOutputScript) {
  return new bsv.Transaction.Output({
    satoshis: 0,
    script: new bsv.Script(minerInfoOutputScript)
  })
}

function getMinerInfoJSONDocument(minerInfoOutputScript) {
  const minerInfoOutput = createTxOutput(minerInfoOutputScript)
  return JSON.parse(Buffer.from(minerInfoOutput.script.toASM().split(' ')[4], 'hex').toString())
}

function getMinerInfoDocSignature(minerInfoOutputScript) {
  const minerInfoOutput = createTxOutput(minerInfoOutputScript)
  return Buffer.from(minerInfoOutput.script.toASM().split(' ')[5], 'hex').toString('hex')
}

function getMinerInfoTxidFromMinerIDCoinbaseTxOutput(minerIdCoinbaseTx) {
  return (Buffer.from(minerIdCoinbaseTx.outputs[1].script.toASM().split(' ')[4], 'hex')).toString('hex')
}

/**
 * The main function.
 */
; (async () => {
  if (network !== 'regtest') {
    console.log('Connect to the "regtest" is required.')
    return
  }

  try {
    /**
     * Connect to BSV Node RPC.
     */
    const url = 'http://' + config.get('bitcoin.rpcHost')
    const user = config.get('bitcoin.rpcUser')
    const pass = config.get('bitcoin.rpcPassword')
    const port = config.get('bitcoin.rpcPort')
    const timeout = 10000
    // Initiate connection.
    const client = new RPCClient({ url, port, timeout, user, pass })
    if (client === undefined) {
       console.log('RPClient: connection error')
       return
    }
    // Check if regtest meets required conditions.
    const blockCount = await client.getblockcount()
    console.log(`Current block count: ${blockCount}`)
    if (blockCount < 101) {
       const numBlocksToGenerate = 101 - blockCount
       console.log(`Make sure that the node has sufficient funds in the wallet (generate ${numBlocksToGenerate})`)
       return
    } else {
       const balance = await client.getbalance()
       console.log('Funds availabe in the wallet: ', balance)
       if (!(balance > 0)) {
          console.log('Error: Insufficient funds to proceed.')
          return
       }
    }

    /**
     * Create a miner-info document with the correct block height.
     *
     * Interaction: The testing script calls the Miner ID Generator.
     */
    let minerInfoOutputScript
    try {
      console.log('\n#1. The script queries the Miner ID Generator to get a new miner-info output script.')
      minerInfoOutputScript = await getMinerInfoOutputScript(ALIAS, blockCount+1)
      console.log(`minerInfoOutputScript= ${minerInfoOutputScript}`)
      console.log('MinerInfo Document: ', getMinerInfoJSONDocument(minerInfoOutputScript))
      console.log('sig(MinerInfo Document): ', getMinerInfoDocSignature(minerInfoOutputScript))
    } catch (e) {
      console.log('Miner ID Generator: ', e)
      return
    }

    /**
     * Create a miner-info tx with the miner-info output script.
     *
     * Interaction: The testing script calls the Node.
     */
    console.log('\n#2. The script queries the Node to create a new miner-info tx with the miner-info output script.')
    const minerInfoTxId = await client.createminerinfotx({hexdata: minerInfoOutputScript})
    if (!minerInfoTxId) {
       console.log("Error: createminerinfotx has failed!")
       return
    }
    console.log(`minerInfoTxId= ${minerInfoTxId}`)
    // Check that the node returns a valid miner-info txid.
    const returnedMinerInfoTxId = await client.getminerinfotxid()
    if (minerInfoTxId != returnedMinerInfoTxId) {
       console.log(`Error: Incorrect miner-info txid= ${returnedMinerInfoTxId} returned, expected-txid= ${minerInfoTxId}`)
       return
    }

    /**
     * Get a mining candidate from the node.
     *
     * Interaction: The testing script calls the Node.
     */
    console.log('\n#3. The script queries the Node to get a mining candidate.')
    const mc = await client.getminingcandidate()


    /**
     * Make a coinbase transaction.
     */
    console.log('\n#4. Make a coinbase transaction.')
    const coinbaseTx = makeCoinbaseTx()

    /**
     * Update coinbase2.
     *
     * Interaction: The testing script calls the Miner ID Generator.
     */
    let updatedCoinbase2
    try {
      console.log('\n#5. The script queries the Miner ID Generator to update the coinbase2')
      updatedCoinbase2 = await modifyCoinbase2(ALIAS, minerInfoTxId, mc.prevhash, mc.merkleProof, getCoinbase2(coinbaseTx))
      console.log(`updatedCoinbase2= ${updatedCoinbase2}`)
    } catch (e) {
      console.log('Miner ID Generator: ', e)
      return
    }

    /**
     * Make Miner ID Coinbase Transaction (combine cb1 & modified cb2)
     */
    const minerIdCoinbaseTx = new bsv.Transaction(placeholderCB1 + updatedCoinbase2)
    console.log('\n#6. RAW Miner ID Coinbase transaction:')
    console.log(minerIdCoinbaseTx.toString())
    //console.log('coinbase output: ', (Buffer.from(minerIdCoinbaseTx.outputs[1].script.toASM().split(' ')[5], 'hex')).toString('hex'))
    const cbTxOutput1MinerInfoTxid = getMinerInfoTxidFromMinerIDCoinbaseTxOutput(minerIdCoinbaseTx)
    if (minerInfoTxId !== cbTxOutput1MinerInfoTxid) {
       console.log(`cbTxOutput1MinerInfoTxid= ${cbTxOutput1MinerInfoTxid}`)
       console.log("Error: Miner-info txid linked with the Miner ID Coinbase tx output is incorrect")
       return
    }
  } catch (e) {
    console.log(`Connection to ${network} error!`, e)
    throw e
  }
  console.log('\nThe script has been executed successfully.')
})()
