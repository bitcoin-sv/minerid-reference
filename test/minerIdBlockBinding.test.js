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
    "blockBind": "d9c2f40bdcb66356ece0ec1250c6ef96dd1d66a83f92d16a5be1efe0ded1df73",
    "blockBindSig": "3044022006be6aa9886ae0db793bc235b2466cc1748b7e34b93ed776e9f89ef36e4b015b022001a0c7d6d9b20f97dbd4a39cb053ab1cfa0fe511410c3ca703c0b345a4d0342f",
    "merkleBranches": ["22fd5416ebd83a374a1fb12005c35bafb7b13087f2266b4cfb493126a821a4cf", "e89cd5f1c27701ead69b871481f97b50b1f8a77c93d261a1fc92a6d618f72215"],
    "prevhash": "000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47",
    "final_cb2": "ffffffff021a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac000000000000000092006a04601dface010020f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e1620d9c2f40bdcb66356ece0ec1250c6ef96dd1d66a83f92d16a5be1efe0ded1df73463044022006be6aa9886ae0db793bc235b2466cc1748b7e34b93ed776e9f89ef36e4b015b022001a0c7d6d9b20f97dbd4a39cb053ab1cfa0fe511410c3ca703c0b345a4d0342f00000000"
  }`
  const sm = JSON.parse(sample)

  beforeEach(() => {
    mock({
      [`${os.homedir()}/.minerid-client/unittest`]: {
        aliases: '[ { "name": "unittest_1" } ]'
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
