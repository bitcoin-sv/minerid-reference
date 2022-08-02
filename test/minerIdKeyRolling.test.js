const rewire = require('rewire')
const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const fm = require('../utils/filemanager')
const cm = require('../utils/common')
const cb = require('../utils/callbacks')

const bsv = require('bsv')
const os = require('os')

const { describe, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')

let sandbox
describe('Key rolling', function () {
  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })
  function mockCallbacks() {
    let checkMinerIdKeysConfirmed = sandbox.stub(cb, 'checkMinerIdKeysConfirmed').returns(false)
    let checkRevocationKeysConfirmed = sandbox.stub(cb, 'checkRevocationKeysConfirmed').returns(false)
    let isMinerIdRevocationConfirmed = sandbox.stub(cb, 'isMinerIdRevocationConfirmed').returns(false)
    let revokeMinerId = sandbox.stub(cb, 'revokeMinerId').returns(false)
  }
  describe('minerId key rotation', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          minerIdAliases: '[ { "name": "unittest_1" } ]',
          minerIdData: '{}',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]',
          revocationKeyData: '{ "prevRevocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61", "revocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61", "prevRevocationKeySig": "3045022100cf459fd3723760cfaad1c1a2df825ac44054256216b76cc8a8e97a5b38cb4fd5022066209f8d53655fdb5b948312ca3051178cb026cb8f95687b8387ccbb5671154f" }'
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K47rYq5fLuFhkYAW2htySkXmb6uXCnPnbNfEcYDymSBU1chDnyTVYTs3Lb6PRhX1dvXm3Zn26ZLnUJLErJTBaZKWmoJpejCY'
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
    it('can rotate the initial minerId for "unittest"', async () => {
      // The initial miner-info document with minerId keys (other fields are skipped in the example for simplicity).
      let firstMinerIdDoc = `{
         "prevMinerId": "028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc",
         "prevMinerIdSig": "304402207b83d9b806ac2cba975ff1877089b6c2b19d55b27a922cc80644fccc757d5aa702203573832a6dd26ea810511a509510284c8304589add7e667b7fdf13943cfdea60",
         "minerId": "028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc"
      }`
      const firstDoc = JSON.parse(firstMinerIdDoc)
      // Check the initial prevMinerId and minerId are the same.
      {
        const prevMinerIdAlias = fm.getPreviousMinerIdAlias('unittest')
        assert.strictEqual(prevMinerIdAlias, 'unittest_1')
        const minerIdAlias = fm.getCurrentMinerIdAlias('unittest')
        assert.strictEqual(minerIdAlias, 'unittest_1')
        assert.strictEqual(fm.getMinerIdPublicKey(prevMinerIdAlias), firstDoc.prevMinerId)
        assert.strictEqual(fm.getMinerIdPublicKey(minerIdAlias), firstDoc.minerId)
      }
      // Check the initial miner-info document before minerId rotation.
      const createMinerInfoDocument = coinbaseDocService.__get__('createMinerInfoDocument')
      const minerIdInitialDoc = await createMinerInfoDocument('unittest', 101 /* a dummy height */)
      assert.strictEqual(minerIdInitialDoc.prevMinerId, firstDoc.prevMinerId)
      assert.strictEqual(minerIdInitialDoc.prevMinerIdSig, firstDoc.prevMinerIdSig)
      assert.strictEqual(minerIdInitialDoc.minerId, firstDoc.minerId)
      // Rotate minerId.
      coinbaseDocService.rotateMinerId('unittest')
      // Check if minerId is rotated (prevMinerId != minerId)
      {
        const prevMinerIdAlias = fm.getPreviousMinerIdAlias('unittest')
        assert.strictEqual(prevMinerIdAlias, 'unittest_1')
        const minerIdAlias = fm.getCurrentMinerIdAlias('unittest')
        assert.strictEqual(minerIdAlias, 'unittest_2')
        assert.strictEqual(fm.getMinerIdPublicKey(prevMinerIdAlias), firstDoc.minerId)
        assert.notEqual(fm.getMinerIdPublicKey(minerIdAlias), firstDoc.minerId)
        assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["prevMinerId"], firstDoc.minerId)
        assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["minerId"], fm.getMinerIdPublicKey(minerIdAlias))
      }
      // Verify prevMinerIdSig creation with rotated key.
      {
        const prevMinerIdSigPayload = Buffer.concat([
           Buffer.from(fm.getMinerIdPublicKey('unittest_1'), 'hex'), // prevMinerId
           Buffer.from(fm.getMinerIdPublicKey('unittest_2'), 'hex')  // minerId
        ])
        const hash = bsv.crypto.Hash.sha256(prevMinerIdSigPayload)
        const prevMinerIdPrivateKey = fm.getMinerIdPrivateKey('unittest_1')
        const prevMinerIdKeySig = bsv.crypto.ECDSA.sign(hash, prevMinerIdPrivateKey)
        const prevMinerIdPublicKey = bsv.PublicKey.fromString(firstDoc.minerId)
        const verified = bsv.crypto.ECDSA.verify(hash, prevMinerIdKeySig, prevMinerIdPublicKey)
        assert.strictEqual(verified, true)
        assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["prevMinerIdSig"], prevMinerIdKeySig.toString('hex'))
      }
      // Check if the miner-info document sets rotated minerId keys correctly.
      const minerIdRotatedDoc = await createMinerInfoDocument('unittest', 101 /* a dummy height */)
      assert.strictEqual(minerIdRotatedDoc.prevMinerId, firstDoc.minerId)
      assert.strictEqual(minerIdRotatedDoc.prevMinerIdSig, fm.readMinerIdDataFromFile('unittest')["prevMinerIdSig"])
      assert.strictEqual(minerIdRotatedDoc.minerId, fm.readMinerIdDataFromFile('unittest')["minerId"])
      // Mark rpc check to form a new miner-info doc containing a new Miner ID chain.
      let minerIdData = {}
      minerIdData = fm.readMinerIdDataFromFile('unittest')
      const minerId = minerIdData["minerId"]
      const prevMinerId = minerId
      const hash = bsv.crypto.Hash.sha256(cm.concatFields(prevMinerId, minerId))
      const minerIdPrivateKey = fm.getMinerIdPrivateKey('unittest_2')
      const prevMinerIdSig = bsv.crypto.ECDSA.sign(hash, minerIdPrivateKey).toString('hex')
      fm.updateKeysInfoInMinerIdDataFile2('unittest', minerIdData, prevMinerId, minerId, prevMinerIdSig)
      // Check if the first miner-info document - in the new chain - sets prevMinerId and minerId to the same value.
      const firstDocInNewChain = await createMinerInfoDocument('unittest', 101 /* a dummy height */)
      assert.strictEqual(firstDocInNewChain.minerId, firstDocInNewChain.prevMinerId)
      assert.strictEqual(firstDocInNewChain.prevMinerId, fm.readMinerIdDataFromFile('unittest')["prevMinerId"])
      assert.strictEqual(firstDocInNewChain.prevMinerIdSig, fm.readMinerIdDataFromFile('unittest')["prevMinerIdSig"])
      assert.strictEqual(firstDocInNewChain.minerId, fm.readMinerIdDataFromFile('unittest')["minerId"])
    })
  })

  describe('revocationKey rotation', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          minerIdAliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]',
          minerIdData: '{}',
          revocationKeyData: '{ "prevRevocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61", "revocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61", "prevRevocationKeySig": "3045022100cf459fd3723760cfaad1c1a2df825ac44054256216b76cc8a8e97a5b38cb4fd5022066209f8d53655fdb5b948312ca3051178cb026cb8f95687b8387ccbb5671154f" }'
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K47rYq5fLuFhkYAW2htySkXmb6uXCnPnbNfEcYDymSBU1chDnyTVYTs3Lb6PRhX1dvXm3Zn26ZLnUJLErJTBaZKWmoJpejCY'
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

    it('can rotate the initial revocationKey for "unittest" and write/read its outcome from the result files', async () => {
      // The initial miner-info document with minerId keys (other fields are skipped in the example for simplicity).
      let firstMinerIdDoc = `{
         "prevRevocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61",
         "prevRevocationKeySig": "3045022100cf459fd3723760cfaad1c1a2df825ac44054256216b76cc8a8e97a5b38cb4fd5022066209f8d53655fdb5b948312ca3051178cb026cb8f95687b8387ccbb5671154f",
         "revocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61"
      }`
      const firstDoc = JSON.parse(firstMinerIdDoc)
      // Check the initial prevRevocationKey and revocationKey are the same.
      {
        const prevRevocationKeyAlias = fm.getPreviousRevocationKeyAlias('unittest')
        assert.strictEqual(prevRevocationKeyAlias, 'unittest_1')
        const revocationKeyAlias = fm.getCurrentRevocationKeyAlias('unittest')
        assert.strictEqual(revocationKeyAlias, 'unittest_1')
	assert.strictEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), fm.getRevocationKeyPublicKey(revocationKeyAlias))
        assert.strictEqual(fm.readRevocationKeyDataFromFile('unittest')["prevRevocationKey"], fm.readRevocationKeyDataFromFile('unittest')["revocationKey"])
      }
      // Check the initial miner-info document before revocationKey rotation.
      const createMinerInfoDocument = coinbaseDocService.__get__('createMinerInfoDocument')
      const minerIdInitialDoc = await createMinerInfoDocument('unittest', 101 /* a dummy height */)
      assert.strictEqual(minerIdInitialDoc.prevRevocationKey, firstDoc.prevRevocationKey)
      assert.strictEqual(minerIdInitialDoc.prevRevocationKeySig, firstDoc.prevRevocationKeySig)
      assert.strictEqual(minerIdInitialDoc.revocationKey, firstDoc.revocationKey)
      // Rotate the revocation key.
      assert.strictEqual(coinbaseDocService.rotateRevocationKey('unittest'), true)
      // Check if revocationKey is correctly rotated (prevRevocationKey != revocationKey).
      {
        const prevRevocationKeyAlias = fm.getPreviousRevocationKeyAlias('unittest')
        assert.strictEqual(prevRevocationKeyAlias, 'unittest_1')
	assert.strictEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), firstDoc.prevRevocationKey)
        const revocationKeyAlias = fm.getCurrentRevocationKeyAlias('unittest')
        assert.strictEqual(revocationKeyAlias, 'unittest_2')
	assert.notEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), fm.getRevocationKeyPublicKey(revocationKeyAlias))
      }
      // Write reusable revocation key data to files.
      fm.writeRevocationKeyDataToFile('unittest', true)
      {
        assert.strictEqual(fm.getRevocationKeyPublicKey('unittest_1'), firstDoc.prevRevocationKey)
        assert.notEqual(fm.getRevocationKeyPublicKey('unittest_2'), firstDoc.revocationKey)
        assert.strictEqual(fm.getRevocationKeyPublicKey('unittest_2'), fm.readRevocationKeyDataFromFile('unittest')["revocationKey"])
        assert.notEqual(fm.readRevocationKeyDataFromFile('unittest')["prevRevocationKey"], fm.readRevocationKeyDataFromFile('unittest')["revocationKey"])
      }
      // Check if the signature is correct.
      {
        const prevRevocationKeySigPayload = Buffer.concat([
           Buffer.from(fm.getRevocationKeyPublicKey('unittest_1'), 'hex'), // prevRevocationKey
           Buffer.from(fm.getRevocationKeyPublicKey('unittest_2'), 'hex')  // revocationKey
        ])
        const hash = bsv.crypto.Hash.sha256(prevRevocationKeySigPayload)
        const prevRevocationKeyPrivateKey = fm.getRevocationKeyPrivateKey('unittest_1')
        const expectedPrevRevocationKeySig = bsv.crypto.ECDSA.sign(hash, prevRevocationKeyPrivateKey)
        assert.strictEqual(fm.readRevocationKeyDataFromFile('unittest')["prevRevocationKeySig"], expectedPrevRevocationKeySig.toString())
      }
      // Check if the miner-info document sets rotated revocation keys correctly.
      const revocationKeyRotatedDoc = await createMinerInfoDocument('unittest', 101 /* a dummy height */)
      assert.strictEqual(revocationKeyRotatedDoc.prevRevocationKey, firstDoc.revocationKey)
      assert.strictEqual(revocationKeyRotatedDoc.prevRevocationKeySig, fm.readRevocationKeyDataFromFile('unittest')["prevRevocationKeySig"])
      assert.strictEqual(revocationKeyRotatedDoc.revocationKey, fm.readRevocationKeyDataFromFile('unittest')["revocationKey"])
      // Mark rpc check to acknowledge revocationKey key rotation.
      let revocationKeyData2 = {}
      const revocationKeyData = fm.readRevocationKeyDataFromFile('unittest')
      revocationKeyData2["revocationKey"] = revocationKeyData.nextDocData["revocationKey"]
      revocationKeyData2["prevRevocationKey"] = revocationKeyData.nextDocData["prevRevocationKey"]
      revocationKeyData2["prevRevocationKeySig"] = revocationKeyData.nextDocData["prevRevocationKey"]
      fm.updateRevocationKeyData('unittest', revocationKeyData2)
      // Check if the first miner-info document - after revocationKey key rotation - sets prevRevocationKey and revocationKey fields to the same value.
      const nextDocData = await createMinerInfoDocument('unittest', 101 /* a dummy height */)
      assert.strictEqual(nextDocData.revocationKey, nextDocData.prevRevocationKey)
      assert.strictEqual(nextDocData.prevRevocationKey, fm.readRevocationKeyDataFromFile('unittest')["prevRevocationKey"])
      assert.strictEqual(nextDocData.prevRevocationKeySig, fm.readRevocationKeyDataFromFile('unittest')["prevRevocationKeySig"])
      assert.strictEqual(nextDocData.revocationKey, fm.readRevocationKeyDataFromFile('unittest')["revocationKey"])
    })
  })
})
