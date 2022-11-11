// Distributed under the Open BSV software license, see the accompanying file LICENSE.

/**
 * This test aims to verify a basic communication between the Script, Miner ID Generator & Node.
 *
 *
 * Prerequisities:
 *
 * 1. BSV Node.
 *
 * Set up and run a node connected to the regtest (see config/default.json configuration file).
 *   (a) Add 'standalone=1' to bitcoin.conf.
 *   (b) Make sure that funds to spend are available (generate 101)
 *   (c) Configure the node to be capable to sign miner-info transactions:
 *       (c1) Create a BIP-32 signing key to sign a miner-info tx:
 *              bitcoin-cli makeminerinfotxsigningkey
 *       (c2) Get the miner-info funding address:
 *              bitcoin-cli getminerinfotxfundingaddress
 *       (c3) Send some minimal BSV amount (0.1) to the generated miner-info funding address, e.g., using:
 *              bitcoin-cli sendtoaddress "address" "amount"
 *       (c4) Configure the node to use the miner-info funding outpoint:
 *              bitcoin-cli setminerinfotxfundingoutpoint "txid" "n"
 *
 * 2. Miner ID Generator.
 *
 * Set up and run the web server.
 *   (a) create a new 'testMiner' alias via CLI interface (npm run cli -- generateminerid --name testMiner)
 *   (b) check if 'config/default.json' settings are correctly configured to allow rpc connection to the Node.
 *       (b1) change the default port to 9003 and disable authentication
 *            (for instance use: export NODE_CONFIG='{"port": 9003, "authentication": {"enabled": false}}')
 *   (c) (optional step) enable dataRefs support
 *       (c1) to enable a dataRefs tx creation add the 'dataRefsTxData' data file with a sample configuration, e.g.:
 *           {
 *              "dataRefs": {
 *                  "refs": [
 *                      {
 *                          "brfcIds": ["62b21572ca46", "a224052ad433"],
 *                           "data": {
 *                               "62b21572ca46": {
 *                                   "alpha": 1
 *                               },
 *                               "a224052ad433": {
 *                                   "omega": 800
 *                               }
 *                           },
 *                           "vout": 0
 *                      }
 *                  ]
 *               }
 *           }
 *
 *           Note:
 *            1. The expected location of this file is: ~/.minerid-client/testMiner/dataRefsTxData.
 *            2. The example above allows to test a datarefs tx creation by this script.
 *            3. The outcome of the 'dataRefsTxData' configuration is a new 'dataRefs' data file created by the Generator.
 *
 *       (c2) to enable only datarefs re-usage add the 'dataRefs' data file with a sample configuration, e.g.:
 *          {
 *              "dataRefs": {
 *                  "refs": [
 *                      {
 *                          "brfcIds": [
 *                               "62b21572ca46",
 *                               "a224052ad433"
 *                          ],
 *                          "txid": "140a4ae78ae06ff24655be3c0d748ba8d8969ef492a411a700cdad45d9b780bf",
 *                          "vout": 0
 *                      }
 *                  ]
 *              }
 *          }
 *
 *          Note: The expected location of this file is: ~/.minerid-client/testMiner/dataRefs.
 *
 *   (d) npm start
 *       Note: Start the server in the same terminal where the (b) step has been configured.
 *
 * The testing script performs the following operations:
 * 1. Calls the MID Generator and the Node to create a datarefs tx if the alias was configured to enable datarefs cretation.
 * 2. Calls the MID Generator to create a new miner-info output script for the given block height.
 * 3. Calls the Node to create a new miner-info tx containing the output script from the point 2.
 * 4. Calls the Node to get a mining candidate.
 * 5. Creates a coinbase transaction.
 * 6. Calls the MID Generator to update the coinbase2 part of the coinbase tx.
 * 7. Updates the coinbase tx and prints out its raw representation.
 * 8. Finds PoW for the miner ID block and sends it to the Node.
 *
 * Note: To run the test use: 'node examples/testMiner.js'
 */
const bsv = require('bsv')
var BlockHeader = bsv.BlockHeader
var Transaction = bsv.Transaction
var Script = bsv.Script
const config = require('config')
const rp = require('request-promise')

const mi = require('../utils/minerinfo')
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

async function getMinerInfoOutputScript (alias, height, dataRefsTxId) {
  let uri = `http://localhost:${PORT_NUMBER}/opreturn/${alias}/${height}/`
  if (dataRefsTxId !== undefined) {
    uri += `${dataRefsTxId}`
  }
  const requestOptions = {
    method: 'GET',
    uri: uri,
    resolveWithFullResponse: true
  }
  return await executeRequest(requestOptions)
}

async function getDataRefsOutputScripts (alias) {
  const requestOptions = {
    method: 'GET',
    uri: `http://localhost:${PORT_NUMBER}/datarefs/${alias}/opreturns`,
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
  const coinbaseInput = new Transaction.Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xFFFFFFFF,
    script: new Script()
  })
  return new Transaction()
    .uncheckedAddInput(coinbaseInput)
    .to(address, 1250000000)
}

function getCoinbase2(tx) {
  return Buffer.from(tx.toString().substring(84)) // the coinbase2 part starts at the index 84
}

function createTxOutput(minerInfoOutputScript) {
  return new Transaction.Output({
    satoshis: 0,
    script: new Script(minerInfoOutputScript)
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
  return (Buffer.from(minerIdCoinbaseTx.outputs[1].script.toASM().split(' ')[4], 'hex')).reverse().toString('hex')
}

/**
 * The main function.
 */
; (async () => {
  if (network !== 'regtest') {
    console.error('Connect to the "regtest" is required.')
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
       throw new Error("RPClient: connection error")
    }
    // Check if regtest meets required conditions.
    const blockCount = await client.getblockcount()
    console.log(`Current block count: ${blockCount}`)
    if (blockCount < 101) {
       throw new Error(`Make sure that the node has sufficient funds in the wallet (bitcoin-cli generate ${101 - blockCount})`)
    } else {
       const balance = await client.getbalance()
       console.log('Funds available in the wallet: ', balance)
       if (!(balance > 0)) {
          throw new Error("Insufficient funds to proceed.")
       }
    }

    /**
     * Create a datarefs tx if the alias was configured to create one.
     *
     * Interactions:
     * (1) The testing script calls the MID Generator.
     * (2) The testing script calls the Node.
     */
    let dataRefsOutputScripts
    try {
      console.log('\n#1. The script queries the MID Generator to get datarefs output scripts.')
      dataRefsOutputScripts = JSON.parse(await getDataRefsOutputScripts(ALIAS))
    } catch (e) {
      console.error('MID Generator: ', e)
      return
    }
    let dataRefsTxId
    if (Array.isArray(dataRefsOutputScripts) && dataRefsOutputScripts.length) {
      dataRefsTxId = await client.createdatareftx({scriptPubKeys: dataRefsOutputScripts})
      console.log(`dataRefsTxId= ${dataRefsTxId} created`)
      console.log(`dataRefsOutputScripts= ${dataRefsOutputScripts}`)
    } else {
      console.log('DataRefs configuration doesn\'t exist')
    }

    /**
     * Create a miner-info document with the correct block height.
     *
     * Interaction: The testing script calls the Miner ID Generator.
     */
    let minerInfoOutputScript
    try {
      console.log('\n#2. The script queries the MID Generator to get a new miner-info output script.')
      minerInfoOutputScript = await getMinerInfoOutputScript(ALIAS, blockCount+1, dataRefsTxId)
      console.log(`minerInfoOutputScript= ${minerInfoOutputScript}`)
      console.log('\nMinerInfo Document: ', JSON.stringify(getMinerInfoJSONDocument(minerInfoOutputScript)))
      console.log('\nsig(MinerInfo Document): ', getMinerInfoDocSignature(minerInfoOutputScript))
    } catch (e) {
      console.error('MID Generator: ', e)
      return
    }

    /**
     * Create a miner-info tx with the miner-info output script.
     *
     * Interaction: The testing script calls the Node.
     */
    console.log('\n#3. The script queries the Node to create a new miner-info tx with the miner-info output script.')
    const minerInfoTxId = await client.createminerinfotx({hexdata: minerInfoOutputScript})
    if (!minerInfoTxId) {
       throw new Error("createminerinfotx has failed!")
    }
    console.log(`minerInfoTxId= ${minerInfoTxId} created`)
    // Check that the node returns a valid miner-info txid.
    const returnedMinerInfoTxId = await client.getminerinfotxid()
    if (minerInfoTxId != returnedMinerInfoTxId) {
       throw new Error(`Incorrect miner-info txid= ${returnedMinerInfoTxId} returned, expected-txid= ${minerInfoTxId}`)
    }

    /**
     * Check if the Node's mempool contains expected miner ID transactions.
     */
    const rawMempool = await client.getrawmempool()
    if (minerInfoTxId && !rawMempool.includes(minerInfoTxId)) {
      throw new Error("Mempool is missing a minerInfo transaction !")
    }
    if (dataRefsTxId && !rawMempool.includes(dataRefsTxId)) {
      throw new Error("Mempool is missing a dataRefs transaction !")
    }
    console.log('\nMempool transactions : ', await client.getrawmempool())

    /**
     * Get a mining candidate from the node.
     *
     * Interaction: The testing script calls the Node.
     */
    console.log('\n#4. The script queries the Node to get a mining candidate.')
    const mc = await client.getminingcandidate()
    console.log(`\nmc= ${JSON.stringify(mc)}`)

    /**
     * Make a coinbase transaction.
     */
    console.log('\n#5. Make a coinbase transaction.')
    const coinbaseTx = makeCoinbaseTx()

    /**
     * Update coinbase2.
     *
     * Interaction: The testing script calls the Miner ID Generator.
     */
    let updatedCoinbase2
    try {
      console.log('\n#6. The script queries the MID Generator to update the coinbase2')
      updatedCoinbase2 = await modifyCoinbase2(ALIAS, minerInfoTxId, mc.prevhash, mc.merkleProof, getCoinbase2(coinbaseTx))
      console.log(`updatedCoinbase2= ${updatedCoinbase2}`)
    } catch (e) {
      console.error('MID Generator: ', e)
      return
    }

    /**
     * Make the miner ID coinbase transaction (combine cb1 & modified cb2)
     */
    console.log('\n#7. RAW miner ID coinbase transaction:')
    const minerIdCoinbaseTx = new Transaction(mi.placeholderCB1 + updatedCoinbase2)
    console.log('txid= ', minerIdCoinbaseTx.id.toString())
    console.log('raw= ', minerIdCoinbaseTx.toString())
    const cbTxOutput1MinerInfoTxid = getMinerInfoTxidFromMinerIDCoinbaseTxOutput(minerIdCoinbaseTx)
    if (minerInfoTxId !== cbTxOutput1MinerInfoTxid) {
       throw new Error(`Miner-info txid linked with the Miner ID Coinbase tx output is incorrect: ${cbTxOutput1MinerInfoTxid}`)
    }

    /**
     * Mine the miner ID block and submit the mining solution to the Node.
     */
    console.log('\n#8. Find PoW for the miner ID block and send it to the Node.')
    let nNonce = 0
    let bh = {}
    do {
       bh = new BlockHeader({
         version: mc["version"],
         prevHash: mc["prevhash"],
         merkleRoot: mi.buildMerkleRootFromCoinbase(minerIdCoinbaseTx.id, mc["merkleProof"]),
         time: mc["time"],
         bits: 0x207fffff, // the expected number of bits on regtest
         nonce: ++nNonce
       })
     }
     while (!bh.validProofOfWork(bh));
     console.log(`bh.hash= ${bh.hash}, nNonce: ${nNonce}`)

     await client.submitminingsolution({id: mc["id"], nonce: nNonce, coinbase: minerIdCoinbaseTx.toString(), time: mc["time"], version: mc["version"]})
     if (await client.getblockcount() !== mc["height"]) {
       throw new Error('The last submitted block has been rejected by the node !')
     } else {
       console.log(`The miner ID block ${bh.hash} has been accepted.`)
     }
  } catch (e) {
    console.error(`${network} error!`, e)
    return
  }
  console.log('\nThe script has been executed successfully.')
})()
