const rewire = require('rewire')
const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, before, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')
const expect = require('expect.js')

let sandbox

describe('Coinbase Document Services', function () {
  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })
  describe('No mocking', function () {
    describe('Minerid', function () {
      describe('Generate', async () => {
        let getMinerId, createMinerId, saveAlias

        beforeEach(() => {
          sandbox.stub(console, 'log')

          getMinerId = sandbox.stub(fm, 'getMinerId').returns(false)
          createMinerId = sandbox.stub(fm, 'createMinerId')
          saveAlias = sandbox.stub(fm, 'saveAlias')

          coinbaseDocService.generateMinerId('unittest')
        })

        it('calls "getMinerId" with right parameters', () => {
          expect(getMinerId.calledWith('unittest_1')).to.be(true)
        })

        it('calls "createMinerId" with right parameters', () => {
          expect(createMinerId.calledWith('unittest_1')).to.be(true)
        })

        it('calls "createMinerId" with right parameters', () => {
          expect(createMinerId.calledWith('unittest_1')).to.be(true)
        })

        it('calls "saveAlias" with right parameters', () => {
          expect(saveAlias.calledWith('unittest', 'unittest_1')).to.be(true)
        })
      })
      describe('Get current', async () => {
        let getCurrentAlias, getMinerId

        beforeEach(() => {
          getCurrentAlias = sandbox.stub(fm, 'getCurrentAlias').returns({})
          getMinerId = sandbox.stub(fm, 'getMinerId').returns({})

          coinbaseDocService.getCurrentMinerId('unittest')
        })

        it('calls "getCurrentAlias" with right parameters', () => {
          expect(getCurrentAlias.calledWith('unittest')).to.be(true)
        })

        it('calls "getMinerId" with right parameters', () => {
          expect(getMinerId.calledWith({})).to.be(true)
        })
      })
    })

    describe('VCTX', function () {
      describe('Generate VcTx', function () {
        let aliasExists, getOrCreateVctPkStub, unsetGetOrCreateVctPk, getValididyCheckTxStub, unsetGetValididyCheckTx
        beforeEach(async () => {
          aliasExists = sandbox.stub(fm, 'aliasExists').returns(true)

          const getOrCreateVctPkObj = { getOrCreateVctPk: coinbaseDocService.__get__('getOrCreateVctPk') }
          getOrCreateVctPkStub = sandbox.stub(getOrCreateVctPkObj, 'getOrCreateVctPk').returns({})
          unsetGetOrCreateVctPk = coinbaseDocService.__set__('getOrCreateVctPk', getOrCreateVctPkStub)

          const getValididyCheckTxObj = { getValididyCheckTx: coinbaseDocService.__get__('getValididyCheckTx') }
          getValididyCheckTxStub = sandbox.stub(getValididyCheckTxObj, 'getValididyCheckTx').returns({})
          unsetGetValididyCheckTx = coinbaseDocService.__set__('getValididyCheckTx', getValididyCheckTxStub)

          await coinbaseDocService.generateVcTx('unittest')
        })
        afterEach(() => {
          unsetGetOrCreateVctPk()
          unsetGetValididyCheckTx()
        })

        it('calls "aliasExists" with right parameters', () => {
          expect(aliasExists.calledWith('unittest')).to.be(true)
        })

        it('calls "getOrCreateVctPk" with right parameters', () => {
          expect(getOrCreateVctPkStub.calledWith('unittest')).to.be(true)
        })

        it('calls "getValididyCheckTx" with right parameters', () => {
          expect(getValididyCheckTxStub.calledWith('unittest', {})).to.be(true)
        })
      })
    })

    describe('MinerId Rotation', function () {
      let aliasExists, getCurrentAlias, saveAlias, createMinerId
      beforeEach(() => {
        aliasExists = sandbox.stub(fm, 'aliasExists').returns(true)
        getCurrentAlias = sandbox.stub(fm, 'getCurrentAlias').returns('unittest_1')
        saveAlias = sandbox.stub(fm, 'saveAlias')
        createMinerId = sandbox.stub(fm, 'createMinerId')

        coinbaseDocService.rotateMinerId('unittest')
      })

      it('calls "aliasExists" with right parameters', () => {
        expect(aliasExists.calledWith('unittest')).to.be(true)
      })

      it('calls "getCurrentAlias" with right parameters', () => {
        expect(getCurrentAlias.calledWith('unittest')).to.be(true)
      })

      it('calls "saveAlias" with right parameters', () => {
        expect(saveAlias.calledWith('unittest', 'unittest_2')).to.be(true)
      })

      it('calls "createMinerId" with right parameters', () => {
        expect(createMinerId.calledWith('unittest_2')).to.be(true)
      })
    })

    describe('Coinbase document', function () {
      describe('Script creation', function () {
        it('can create coinbase OP_RETURN script from doc and sig', () => {
          const createCoinbaseOpReturn = coinbaseDocService.__get__('createCoinbaseOpReturn')

          const doc = '{"version":"0.1","height":1234,"prevMinerId":"02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab","prevMinerIdSig":"3045022100f705b13ef5cd9b0f27ef92ce8db087e968ba4a71b695cac821827caa4a9db6fd02203905bcf845f554067b1d1529d46c598fc15741b2a2c6eadf819ee18b40a5f879","minerId":"02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab","vctx":{"txId":"6839008199026098cc78bf5f34c9a6bdf7a8009c9f019f8399c7ca1945b4a4ff","vout":0}}'
          const sig = '3045022100ac053cc88d0286691532282641e3613ec80c90563b508ead03adf91ebbc3ec7f02202b3b79a032e4be25abb6b3c2749597ff5b6284deb09da540609e1aefc9444073'

          const script = createCoinbaseOpReturn(doc, sig)

          const expectedScript = '006a04ac1eed884dbf017b2276657273696f6e223a22302e31222c22686569676874223a313233342c22707265764d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c22707265764d696e65724964536967223a2233303435303232313030663730356231336566356364396230663237656639326365386462303837653936386261346137316236393563616338323138323763616134613964623666643032323033393035626366383435663535343036376231643135323964343663353938666331353734316232613263366561646638313965653138623430613566383739222c226d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c2276637478223a7b2274784964223a2236383339303038313939303236303938636337386266356633346339613662646637613830303963396630313966383339396337636131393435623461346666222c22766f7574223a307d7d473045022100ac053cc88d0286691532282641e3613ec80c90563b508ead03adf91ebbc3ec7f02202b3b79a032e4be25abb6b3c2749597ff5b6284deb09da540609e1aefc9444073'

          assert.strict.equal(script, expectedScript)
        })
      })

      describe('Document creation', () => {
        let getOptionalMinerData, getPreviousAlias, signStub, unset, minerIdSigPayload
        beforeEach(() => {
          getPreviousAlias = sandbox.stub(fm, 'getPreviousAlias').returns('unittest_1')
          getOptionalMinerData = sandbox.stub(fm, 'getOptionalMinerData').returns({})

          const signObj = { sign: coinbaseDocService.__get__('sign') }
          signStub = sandbox.stub(signObj, 'sign').returns({})
          unset = coinbaseDocService.__set__('sign', signStub)

          const createCoinbaseDocument = coinbaseDocService.__get__('createCoinbaseDocument')

          const minerId = '02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab'
          const prevMinerId = '02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab'
          const vcTx = '6839008199026098cc78bf5f34c9a6bdf7a8009c9f019f8399c7ca1945b4a4ff'
          createCoinbaseDocument('unittest', 1234, minerId, minerId, vcTx)

          minerIdSigPayload = Buffer.concat([
            Buffer.from(prevMinerId),
            Buffer.from(minerId),
            Buffer.from(vcTx)
          ])
        })
        afterEach(() => {
          unset()
        })

        it('calls "getPreviousAlias" with right parameters', () => {
          expect(getPreviousAlias.calledWith('unittest')).to.be(true)
        })

        it('calls "getOptionalMinerData" with right parameters', () => {
          expect(getOptionalMinerData.calledWith('unittest')).to.be(true)
        })

        it('calls "sign" with right parameters', () => {
          expect(signStub.calledWith(minerIdSigPayload, 'unittest_1')).to.be(true)
        })

        // describe('Extensions', function () {
        //   describe('Blockbind', function () {
        //     it('can create a Merkle root from coinbase tx and Merkle branches', () => {
        //       const createCoinbaseOpReturn = coinbaseDocService.__get__('createCoinbaseOpReturn')

        //       const doc = '{"version":"0.1","height":1234,"prevMinerId":"02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab","prevMinerIdSig":"3045022100f705b13ef5cd9b0f27ef92ce8db087e968ba4a71b695cac821827caa4a9db6fd02203905bcf845f554067b1d1529d46c598fc15741b2a2c6eadf819ee18b40a5f879","minerId":"02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab","vctx":{"txId":"6839008199026098cc78bf5f34c9a6bdf7a8009c9f019f8399c7ca1945b4a4ff","vout":0}}'
        //       const sig = '3045022100ac053cc88d0286691532282641e3613ec80c90563b508ead03adf91ebbc3ec7f02202b3b79a032e4be25abb6b3c2749597ff5b6284deb09da540609e1aefc9444073'

        //       const script = createCoinbaseOpReturn(doc, sig)

        //       const expectedScript = '006a04ac1eed884dbf017b2276657273696f6e223a22302e31222c22686569676874223a313233342c22707265764d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c22707265764d696e65724964536967223a2233303435303232313030663730356231336566356364396230663237656639326365386462303837653936386261346137316236393563616338323138323763616134613964623666643032323033393035626366383435663535343036376231643135323964343663353938666331353734316232613263366561646638313965653138623430613566383739222c226d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c2276637478223a7b2274784964223a2236383339303038313939303236303938636337386266356633346339613662646637613830303963396630313966383339396337636131393435623461346666222c22766f7574223a307d7d473045022100ac053cc88d0286691532282641e3613ec80c90563b508ead03adf91ebbc3ec7f02202b3b79a032e4be25abb6b3c2749597ff5b6284deb09da540609e1aefc9444073'

        //       assert.strict.equal(script, expectedScript)
        //     })
        //   })
        // })
      })
    })
  })

  describe('Directories mocked (.minerid-client & .keystore)', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          'aliases': '[ { "name": "unittest_1" } ]',
          'config': `{
                        "email": "testMiner@testDomain.com"
                    }`,
          'vctx': `{
                        "prv": "KxmBu7NFRxWsT6gcwBDCtthWnokPJhHDVajYAVvTwfucFKdMf1dP",
                        "txid": "6839008199026098cc78bf5f34c9a6bdf7a8009c9f019f8399c7ca1945b4a4ff"
                      }`
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ'
        }
      })
    })
    afterEach(() => {
      mock.restore()
    })

    it('can get the current MinerId for "unittest"', async () => {
      const currentAlias = coinbaseDocService.getCurrentMinerId('unittest')

      const expectedCurrentAlias = '028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc'
      assert.strict.deepEqual(currentAlias, expectedCurrentAlias)
    })

    describe('Signing', function () {
      it('can sign with MinerId key for "unittest"', () => {
        const hash = 'b391347e78e93f05547c6a643dba2ea7df50effdf40061152fab922cbbbef072'

        const signWithCurrentMinerId = coinbaseDocService.__get__('signWithCurrentMinerId')
        const sig = signWithCurrentMinerId(hash, 'unittest')

        const priv = new bsv.HDPrivateKey('xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ').privateKey
        const expectedSig = new bsv.crypto.ECDSA.sign(Buffer.from(hash, 'hex'), priv)

        assert.strict.deepEqual(sig, expectedSig.toString())
      })

      describe('SignHash', function () {
        let unset, signHashStub
        beforeEach(() => {
          const signHashObj = { signHash: coinbaseDocService.__get__('signHash') }
          signHashStub = sandbox.stub(signHashObj, 'signHash').returns({})
          unset = coinbaseDocService.__set__('signHash', signHashStub)
        })
        afterEach(() => {
          unset()
        })

        it('signWithCurrentMinerId is calling getCurrentAlias and signHash with the right parameters', () => {
          const getCurrentAlias = sandbox.stub(fm, 'getCurrentAlias').returns('unittest_1')

          const hash = 'b391347e78e93f05547c6a643dba2ea7df50effdf40061152fab922cbbbef072'

          const signWithCurrentMinerId = coinbaseDocService.__get__('signWithCurrentMinerId')
          signWithCurrentMinerId(hash, 'unittest')

          expect(getCurrentAlias.calledWith('unittest')).to.be(true)
          expect(signHashStub.calledWith(Buffer.from(hash, 'hex'), 'unittest_1')).to.be(true)
        })

        it('sign is calling signHash with the right parameters', () => {
          const sign = coinbaseDocService.__get__('sign')

          const payload = Buffer.from('1234', 'hex')
          sign(payload, 'unittest')

          const hash = bsv.crypto.Hash.sha256(payload)

          expect(signHashStub.calledWith(hash, 'unittest')).to.be(true)
        })
      })
    })
  })
})
