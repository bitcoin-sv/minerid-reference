const rewire = require('rewire')
const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')

describe('Key rolling', function () {
  describe('minerId key rotation', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]'
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ'
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
      // Check the initial prevMinerId and minerId are the same.
      {
        const prevMinerIdAlias = fm.getPreviousMinerIdAlias('unittest')
        assert.strictEqual(prevMinerIdAlias, 'unittest_1')
        const minerIdAlias = fm.getCurrentMinerIdAlias('unittest')
        assert.strictEqual(minerIdAlias, 'unittest_1')
        assert.strictEqual(fm.getMinerIdPublicKey(prevMinerIdAlias), '028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc')
        assert.strictEqual(fm.getMinerIdPublicKey(minerIdAlias), '028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc')
      }
      // Rotate minerId.
      coinbaseDocService.rotateMinerId('unittest')
      // Check if minerId is rotated (prevMinerId != minerId)
      {
        const prevMinerIdAlias = fm.getPreviousMinerIdAlias('unittest')
        assert.strictEqual(prevMinerIdAlias, 'unittest_1')
        const minerIdAlias = fm.getCurrentMinerIdAlias('unittest')
        assert.strictEqual(minerIdAlias, 'unittest_2')
        assert.strictEqual(fm.getMinerIdPublicKey(prevMinerIdAlias), '028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc')
        assert.notEqual(fm.getMinerIdPublicKey(minerIdAlias), '028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc')
      }
      // Verify prevMinerIdSig creation with rotated key.
      {
        const prevMinerIdSigPayload = Buffer.concat([
           Buffer.from(fm.getMinerIdPublicKey('unittest_1'), 'hex'), // prevMinerId
           Buffer.from(fm.getMinerIdPublicKey('unittest_2'), 'hex')  // minerId
        ])
        const hash = bsv.crypto.Hash.sha256(prevMinerIdSigPayload)
        const prevMinerIdPrivateKey = fm.getPrivateKey('unittest_1')
        const prevMinerIdKeySig = bsv.crypto.ECDSA.sign(hash, prevMinerIdPrivateKey)
        const prevMinerIdPublicKey = bsv.PublicKey.fromString('028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc')
        const verified = bsv.crypto.ECDSA.verify(hash, prevMinerIdKeySig, prevMinerIdPublicKey)
        assert.strictEqual(verified, true)
      }
    })
  })

  describe('revocationKey rotation', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]',
          revocationKeyData: '{ "prevRevocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61", "revocationKey": "03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61", "prevRevocationKeySig": "3045022100cf459fd3723760cfaad1c1a2df825ac44054256216b76cc8a8e97a5b38cb4fd5022066209f8d53655fdb5b948312ca3051178cb026cb8f95687b8387ccbb5671154f" }'
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
      // Check the initial prevRevocationKey and revocationKey are the same.
      {
        const prevRevocationKeyAlias = fm.getPreviousRevocationKeyAlias('unittest')
        assert.strictEqual(prevRevocationKeyAlias, 'unittest_1')
        const revocationKeyAlias = fm.getCurrentRevocationKeyAlias('unittest')
        assert.strictEqual(revocationKeyAlias, 'unittest_1')
	assert.strictEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), fm.getRevocationKeyPublicKey(revocationKeyAlias))
        assert.strictEqual(fm.readPrevRevocationKeyPublicKeyFromFile('unittest'), fm.readRevocationKeyPublicKeyFromFile('unittest'))
      }
      // Rotate the revocation key.
      assert.strictEqual(coinbaseDocService.rotateRevocationKey('unittest'), true)
      // Check if revocationKey is correctly rotated (prevRevocationKey != revocationKey).
      {
        const prevRevocationKeyAlias = fm.getPreviousRevocationKeyAlias('unittest')
        assert.strictEqual(prevRevocationKeyAlias, 'unittest_1')
	assert.strictEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), '03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61')
        const revocationKeyAlias = fm.getCurrentRevocationKeyAlias('unittest')
        assert.strictEqual(revocationKeyAlias, 'unittest_2')
	assert.notEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), fm.getRevocationKeyPublicKey(revocationKeyAlias))
      }
      // Write reusable revocation key data to files.
      fm.writeRevocationKeyDataToFile('unittest')
      {
        assert.strictEqual(fm.getRevocationKeyPublicKey('unittest_1'), '03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61')
        assert.notEqual(fm.getRevocationKeyPublicKey('unittest_2'), '03e19a7d21b453bd51ad80d90a7af00fe26247ca2e7e7e51a97525aef96b20bc61')
        assert.strictEqual(fm.getRevocationKeyPublicKey('unittest_2'), fm.readRevocationKeyPublicKeyFromFile('unittest'))
        assert.notEqual(fm.readPrevRevocationKeyPublicKeyFromFile('unittest'), fm.readRevocationKeyPublicKeyFromFile('unittest'))
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
        assert.strictEqual(fm.readPrevRevocationKeySigFromFile('unittest'), expectedPrevRevocationKeySig.toString())
      }
    })
  })
})
