//const rewire = require('rewire')
//const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')

// The revocationKey private key must be available only to perform:
// (1) minerId revocation procedure, or
// (2) revocationKey rotation
// In all other cases it should be kept offline.
//
// The following test checks if reusable revocationKey data are created during revocationKey creation.
describe('Reusable revocationKey data', function () {
  describe('Write/Read revocationKey data to/from the config file', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
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

    it('can get the current revocationKey public key for "unittest"', async () => {
      const priv = new bsv.HDPrivateKey('xprv9s21ZrQH143K47rYq5fLuFhkYAW2htySkXmb6uXCnPnbNfEcYDymSBU1chDnyTVYTs3Lb6PRhX1dvXm3Zn26ZLnUJLErJTBaZKWmoJpejCY').privateKey
      const currentAlias = fm.getCurrentAlias('unittest')
      assert.strict.equal('unittest_1', currentAlias)
      assert.strict.deepEqual(fm.getRevocationKeyPublicKey(currentAlias), priv.publicKey.toString())
    })

    it('can write and read the initial revocationKey data for "unittest"', async () => {
      const priv = new bsv.HDPrivateKey('xprv9s21ZrQH143K47rYq5fLuFhkYAW2htySkXmb6uXCnPnbNfEcYDymSBU1chDnyTVYTs3Lb6PRhX1dvXm3Zn26ZLnUJLErJTBaZKWmoJpejCY').privateKey
      fm.writeRevocationKeyDataToFile('unittest')
      assert.strict.deepEqual(fm.readPrevRevocationKeyPublicKeyFromFile('unittest'), priv.publicKey.toString())
      assert.strict.deepEqual(fm.readRevocationKeyPublicKeyFromFile('unittest'), priv.publicKey.toString())
      assert.strict.deepEqual(fm.readPrevRevocationKeySigFromFile('unittest'), '3045022100cf459fd3723760cfaad1c1a2df825ac44054256216b76cc8a8e97a5b38cb4fd5022066209f8d53655fdb5b948312ca3051178cb026cb8f95687b8387ccbb5671154f')
    })
  })

  describe('Read revocationKey data from the mocked config file', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
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

    it('can read the initial prevRevocationKey public key for "unittest"', async () => {
      assert.strict.deepEqual(fm.readPrevRevocationKeyPublicKeyFromFile('unittest'), fm.getRevocationKeyPublicKey(fm.getPreviousAlias('unittest')))
    })

    it('can read the initial revocationKey public key for "unittest"', async () => {
      assert.strict.deepEqual(fm.readRevocationKeyPublicKeyFromFile('unittest'), fm.getRevocationKeyPublicKey(fm.getCurrentAlias('unittest')))
    })

    it('can read the initial prevRevocationKeySig for "unittest"', async () => {
      const prevRevocationKeyPublicKey = fm.getRevocationKeyPublicKey(fm.getPreviousAlias('unittest'))
      const revocationKeyPublicKey = fm.getRevocationKeyPublicKey(fm.getCurrentAlias('unittest'))

      const payload = Buffer.concat([
        Buffer.from(prevRevocationKeyPublicKey, 'hex'),
        Buffer.from(revocationKeyPublicKey, 'hex')
      ])

      const hash = bsv.crypto.Hash.sha256(payload)
      const privateKey = fm.getRevocationKeyPrivateKey(fm.getCurrentAlias('unittest'))
      const expectedPrevRevocationKeySig = bsv.crypto.ECDSA.sign(hash, privateKey)
      assert.strict.deepEqual(fm.readPrevRevocationKeySigFromFile('unittest'), expectedPrevRevocationKeySig.toString())
    })
  })
})
