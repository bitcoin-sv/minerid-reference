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
  describe('Revocation key rotation', function () {
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
