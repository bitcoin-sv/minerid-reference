// Distributed under the Open BSV software license, see the accompanying file LICENSE.

const rewire = require('rewire')
const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')

describe('Upgrade Miner ID Protocol', function () {
  describe('Upgrade from v0.1/v0.2 to v0.3 is possible', function () {
    const expFirstMinerId = "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e"
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
      sinon.stub(console, "error")
    })
    afterEach(() => {
      mock.restore()
      console.log.restore()
      console.debug.restore()
      console.error.restore()
    })
    it('can upgrade minerId protocol data for "unittest"', async () => {
      // There is no revocationKey data in the config folder so an upgrade can occur.
      assert.strictEqual(coinbaseDocService.canUpgradeMinerIdProtocol('unittest'), true)
      // Check that the minerId key configuration does exist.
      assert.strictEqual(fm.getCurrentMinerIdAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.getPreviousMinerIdAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.minerIdKeyExists('unittest_1'), true)
      fm.createRevocationKey('unittest_1')
      fm.saveRevocationKeyAlias('unittest', 'unittest_1')
      fm.writeRevocationKeyDataToFile('unittest')
      assert.strictEqual(fm.getCurrentRevocationKeyAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.getPreviousRevocationKeyAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.revocationKeyExists('unittest_1'), true)
      let firstMinerId = {}
      firstMinerId["first_minerId"] = expFirstMinerId
      fm.writeMinerIdDataToFile('unittest', firstMinerId)
      assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["first_minerId"], expFirstMinerId)
      // The rovocation key protocol data were already created so another attempt to upgrade the protocol's data should fail.
      assert.strictEqual(coinbaseDocService.canUpgradeMinerIdProtocol('unittest'), false)
    })
  })

  describe('The protocol\'s configuration is compliant with v0.3', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          minerIdAliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]'
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2MuFMBEMccXsxoz5ShrhQceN32Ycm9j1NrjgRR6AEtocCS83miARoEXpU9rC4UqRvyUjmjvaHzZECZdSYzxSfxAeykBsg92'
        }
      })
      sinon.stub(console, "log")
      sinon.stub(console, "error")
    })
    afterEach(() => {
      mock.restore()
      console.log.restore()
      console.error.restore()
    })
    it('cannot override revocation key data for the existing "unittest" alias', async () => {
      // Check that the minerId key configuration does exist.
      assert.strictEqual(fm.getCurrentMinerIdAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.getPreviousMinerIdAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.minerIdKeyExists('unittest_1'), true)
      // Check that the revocation key coniguration does exist.
      assert.strictEqual(fm.getCurrentRevocationKeyAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.getPreviousRevocationKeyAlias('unittest'), 'unittest_1')
      assert.strictEqual(fm.revocationKeyExists('unittest_1'), true)
      // There are the revocation key data in the config folder so the protocol is already up to date.
      assert.strictEqual(coinbaseDocService.canUpgradeMinerIdProtocol('unittest'), false)
    })
  })
})
