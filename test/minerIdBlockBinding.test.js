// Distributed under the Open BSV software license, see the accompanying file LICENSE.

const rewire = require('rewire')
const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const mi = rewire('../utils/minerinfo')
const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')

describe('Block binding', function () {
  // Sample data to be used in the test.
  let sample = `{
    "cb2": "ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000",
    "minerInfoTxId": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
    "blockBind": "0028944a3a436201521bafa5cf82f873c04d212d62d5811324a1fd14095a6ea2",
    "blockBindSig": "304402206ea641c5a1568d06572629ab46deef74b351d65e5d3112c9c24cecd896a1108c0220337ba129162c26e6aa996d1f88164566c03ee395d75a63033cb421fc432f1e7a",
    "merkleBranches": ["22fd5416ebd83a374a1fb12005c35bafb7b13087f2266b4cfb493126a821a4cf", "e89cd5f1c27701ead69b871481f97b50b1f8a77c93d261a1fc92a6d618f72215"],
    "prevhash": "000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47",
    "final_cb2": "ffffffff021a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac000000000000000092006a04601dface010020169e1e83e930853391bc6f35f605c6754cfead57cf8387639d3b4096c54f18f4200028944a3a436201521bafa5cf82f873c04d212d62d5811324a1fd14095a6ea246304402206ea641c5a1568d06572629ab46deef74b351d65e5d3112c9c24cecd896a1108c0220337ba129162c26e6aa996d1f88164566c03ee395d75a63033cb421fc432f1e7a00000000"
  }`
  const sm = JSON.parse(sample)

  beforeEach(() => {
    mock({
      [`${os.homedir()}/.minerid-client/unittest`]: {
        minerIdAliases: '[ { "name": "unittest_1" } ]'
      },
      [`${os.homedir()}/.keystore`]: {
        'unittest_1.key': 'xprv9s21ZrQH143K2EikiPVYtLM8sUrBeiuJqKFyAzEWyqjyvDwqFt3mtkHvfHjx7276nxnqsqm8VNtiwQZXXo5TK5N7Zy4NycaDdhBYCEMHJbk'
      }
    })
    sinon.stub(console, "log")
    sinon.stub(console, "debug")
  })

  afterEach(() => {
    mock.restore()
    console.log.restore()
    console.debug.restore()
  })

  it('can create coinbase2 with blockBind and blockBindSig for "unittest"', async () => {
    const createCoinbase2 = coinbaseDocService.__get__('createCoinbase2')
    assert.strict.deepEqual(await createCoinbase2('unittest', sm.minerInfoTxId, sm.prevhash, sm.merkleBranches, sm.cb2), sm.final_cb2)
  })

  it('can verify blockBind and blockBindSig for "unittest"', async () => {
    /**
     * Create a miner-info coinbase transaction with an output script containing:
     * (1) minerInfoTxId
     * (2) blockBind
     * (3) blockBindSig
     */
    const ctx = mi.makeCoinbaseTx(mi.placeholderCB1, Buffer.from(sm.cb2, 'hex'))
    const ctx2 = mi.createMinerInfoCoinbaseTxWithBlockBind(ctx, sm.minerInfoTxId, sm.blockBind, sm.blockBindSig)

    /**
     * Re-create a modified miner-info cb transaction based on the final miner-info cb transaction.
     *
     * The outputs[1] script must contain minerInfoTxId.
     */
    // Remove an existing output[1] from ctx2.
    ctx2.removeOutput(1)
    // Use placeholderCB1 and coinbase2 part from ctx2 to re-create a modified coinbase tx.
    const ctxModified = mi.makeCoinbaseTx(mi.placeholderCB1, Buffer.from(ctx2.toString().substring(mi.placeholderCB1.length), 'hex'))
    // Add a new output script with minerInfoTxId.
    ctxModified.addOutput(new bsv.Transaction.Output({
      script: mi.createCoinbaseOpReturnScript(sm.minerInfoTxId),
      satoshis: 0
    }))

    /**
     * Re-create modifiedMerkleRoot.
     */
    const modifiedMerkleRoot = mi.buildMerkleRootFromCoinbase(ctxModified.id, sm.merkleBranches)

    /**
     * Re-create blockBind.
     */
    const blockBindPayload = Buffer.concat([
      Buffer.from(modifiedMerkleRoot, 'hex').reverse(), // swap endianness before concatenating
      Buffer.from(sm.prevhash, 'hex').reverse() // swap endianness before concatenating
    ])
    const actualBlockBind = bsv.crypto.Hash.sha256(blockBindPayload)
    assert.strictEqual(actualBlockBind.toString('hex'), sm.blockBind)

    /**
     * Re-create blockBindSig and verify it.
     */
    const actualBlockBindSig = bsv.crypto.ECDSA.sign(actualBlockBind, fm.getMinerIdPrivateKey(fm.getCurrentMinerIdAlias('unittest')))
    assert.strictEqual(actualBlockBindSig.toString('hex'), sm.blockBindSig)
    // Verify signature.
    const pubkey = bsv.PublicKey.fromString(fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias('unittest')).toString('hex'))
    const verified = bsv.crypto.ECDSA.verify(actualBlockBind, actualBlockBindSig, pubkey)
    assert.strictEqual(verified, true)
  })
})
