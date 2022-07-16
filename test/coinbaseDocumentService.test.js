const rewire = require('rewire')
const coinbaseDocService = rewire('../services/coinbaseDocumentService')
const mi = rewire('../utils/minerinfo')
const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, before, after, beforeEach, afterEach, it } = require('mocha')
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
        let getMinerIdPublicKey, createMinerId, getRevocationKeyPublicKey, createRevocationKey, saveMinerIdAlias, saveRevocationKeyAlias

        beforeEach(() => {
          sandbox.stub(console, 'log')

          getMinerIdPublicKey = sandbox.stub(fm, 'getMinerIdPublicKey').returns(false)
          createMinerId = sandbox.stub(fm, 'createMinerId')

          getRevocationKeyPublicKey = sandbox.stub(fm, 'getRevocationKeyPublicKey').returns(false)
          createRevocationKey = sandbox.stub(fm, 'createRevocationKey')

          saveMinerIdAlias = sandbox.stub(fm, 'saveMinerIdAlias')
          saveRevocationKeyAlias = sandbox.stub(fm, 'saveRevocationKeyAlias')
          writeMinerIdDataToFile = sandbox.stub(fm, 'writeMinerIdDataToFile').returns(false)

          coinbaseDocService.generateMinerId('unittest')
        })
	// Checks if the expected functions were called.
        it('calls "getMinerIdPublicKey" with right parameters', () => {
          expect(getMinerIdPublicKey.calledWith('unittest_1')).to.be(true)
        })

        it('calls "createMinerId" with right parameters', () => {
          expect(createMinerId.calledWith('unittest_1')).to.be(true)
        })

        it('calls "getRevocationKeyPublicKey" with right parameters', () => {
          expect(getRevocationKeyPublicKey.calledWith('unittest_1')).to.be(true)
        })

        it('calls "createRevocationKey" with right parameters', () => {
          expect(createRevocationKey.calledOnceWith('unittest_1')).to.be(true)
        })

        it('calls "saveMinerIdAlias" with right parameters', () => {
          expect(saveMinerIdAlias.calledWith('unittest', 'unittest_1')).to.be(true)
        })

        it('calls "saveRevocationKeyAlias" with right parameters', () => {
          expect(saveRevocationKeyAlias.calledWith('unittest', 'unittest_1')).to.be(true)
        })

        it('calls "writeMinerIdDataToFile" once', () => {
          expect(writeMinerIdDataToFile.calledOnce).to.be(true)
        })
      })

      describe('Get current', async () => {
        let getCurrentMinerIdAlias, getMinerIdPublicKey

        beforeEach(() => {
          getCurrentMinerIdAlias = sandbox.stub(fm, 'getCurrentMinerIdAlias').returns({})
          getMinerIdPublicKey = sandbox.stub(fm, 'getMinerIdPublicKey').returns({})

          coinbaseDocService.getCurrentMinerId('unittest')
        })

        it('calls "getCurrentMinerIdAlias" with right parameters', () => {
          expect(getCurrentMinerIdAlias.calledWith('unittest')).to.be(true)
        })

        it('calls "getMinerIdPublicKey" with right parameters', () => {
          expect(getMinerIdPublicKey.calledWith({})).to.be(true)
        })
      })
    })

    describe('MinerId Rotation', function () {
      let aliasExists, getCurrentMinerIdAlias, saveMinerIdAlias, createMinerId
      beforeEach(() => {
        aliasExists = sandbox.stub(fm, 'aliasExists').returns(true)
        getCurrentMinerIdAlias = sandbox.stub(fm, 'getCurrentMinerIdAlias').returns('unittest_1')
        minerIdKeyExists = sandbox.stub(fm, 'minerIdKeyExists').returns(true)
        saveMinerIdAlias = sandbox.stub(fm, 'saveMinerIdAlias')
        createMinerId = sandbox.stub(fm, 'createMinerId')

        coinbaseDocService.rotateMinerId('unittest')
      })

      it('calls "aliasExists" with right parameters', () => {
        expect(aliasExists.calledWith('unittest')).to.be(true)
      })

      it('calls "getCurrentMinerIdAlias" with right parameters', () => {
        expect(getCurrentMinerIdAlias.calledWith('unittest')).to.be(true)
      })

      it('calls "minerIdKeyExists" with right parameters', () => {
        expect(minerIdKeyExists.calledWith('unittest_1')).to.be(true)
      })

      it('calls "saveMinerIdAlias" with right parameters', () => {
        expect(saveMinerIdAlias.calledWith('unittest', 'unittest_2')).to.be(true)
      })

      it('calls "createMinerId" with right parameters', () => {
        expect(createMinerId.calledWith('unittest_2')).to.be(true)
      })
    })

    describe('Revocation Key Rotation', function () {
      let aliasExists, getCurrentRevocationKeyAlias, saveRevocationKeyAlias, createRevocationKey
      beforeEach(() => {
        aliasExists = sandbox.stub(fm, 'aliasExists').returns(true)
        getCurrentRevocationKeyAlias = sandbox.stub(fm, 'getCurrentRevocationKeyAlias').returns('unittest_1')
	revocationKeyExists = sandbox.stub(fm, 'revocationKeyExists').returns(true)
        saveRevocationKeyAlias = sandbox.stub(fm, 'saveRevocationKeyAlias')
        createRevocationKey = sandbox.stub(fm, 'createRevocationKey')

        coinbaseDocService.rotateRevocationKey('unittest')
      })

      it('calls "aliasExists" with right parameters', () => {
        expect(aliasExists.calledWith('unittest')).to.be(true)
      })

      it('calls "getCurrentRevocationKeyAlias" with right parameters', () => {
        expect(getCurrentRevocationKeyAlias.calledWith('unittest')).to.be(true)
      })

      it('calls "revocationKeyExists" with right parameters', () => {
        expect(revocationKeyExists.calledWith('unittest_1')).to.be(true)
      })

      it('calls "saveRevocationKeyAlias" with right parameters', () => {
        expect(saveRevocationKeyAlias.calledWith('unittest', 'unittest_2')).to.be(true)
      })

      it('calls "createRevocationKey" with right parameters', () => {
        expect(createRevocationKey.calledWith('unittest_2')).to.be(true)
      })
    })

    describe('Miner-info document', function () {
      describe('Script creation', function () {
        it('can create miner-info OP_RETURN script from doc and sig', () => {
          const doc = '{"version":"0.3","height":1234,"prevMinerId":"0257b61d90a166f7cc968ecb7c88101b90065f89d90254d9a7322dac1b43f30c2e","prevMinerIdSig":"30440220519b09620bac825803181cdfd6286b6ed56af688c21407d3401212ec6499c8cc02201cb903b622da00eb3d1d631fac66ec79f44f9c96dcbf3ad7c8dfd0ed4bcfe5ee","minerId":"0257b61d90a166f7cc968ecb7c88101b90065f89d90254d9a7322dac1b43f30c2e","prevRevocationKey":"02d1d4b1c72efa37158eb6d1298303a3b65924af03a481705e76ee405fd9b0207d","revocationKey":"02d1d4b1c72efa37158eb6d1298303a3b65924af03a481705e76ee405fd9b0207d","prevRevocationKeySig":"3045022100d1d5084912fa27f5e9e6bd5f465cb8790760934094daab060d7f677653fb5268022061b5a4bf45baa73e2e033122075d3a1077468397065a113d71969864387f7395"}'
          const sig = '3044022014bfe3df4d4e28ee2985373a3f791bbc52116b13d602b9610cdf139170bea69e02202156e6447f7ce70562695b5ab45e50856201ae812179a1818152f52f7a877750'

          const script = mi.createMinerInfoOpReturnScript(doc, sig).toHex()

	  const expectedScript = '006a04601dface01004db7027b2276657273696f6e223a22302e33222c22686569676874223a313233342c22707265764d696e65724964223a22303235376236316439306131363666376363393638656362376338383130316239303036356638396439303235346439613733323264616331623433663330633265222c22707265764d696e65724964536967223a223330343430323230353139623039363230626163383235383033313831636466643632383662366564353661663638386332313430376433343031323132656336343939633863633032323031636239303362363232646130306562336431643633316661633636656337396634346639633936646362663361643763386466643065643462636665356565222c226d696e65724964223a22303235376236316439306131363666376363393638656362376338383130316239303036356638396439303235346439613733323264616331623433663330633265222c22707265765265766f636174696f6e4b6579223a22303264316434623163373265666133373135386562366431323938333033613362363539323461663033613438313730356537366565343035666439623032303764222c227265766f636174696f6e4b6579223a22303264316434623163373265666133373135386562366431323938333033613362363539323461663033613438313730356537366565343035666439623032303764222c22707265765265766f636174696f6e4b6579536967223a2233303435303232313030643164353038343931326661323766356539653662643566343635636238373930373630393334303934646161623036306437663637373635336662353236383032323036316235613462663435626161373365326530333331323230373564336131303737343638333937303635613131336437313936393836343338376637333935227d463044022014bfe3df4d4e28ee2985373a3f791bbc52116b13d602b9610cdf139170bea69e02202156e6447f7ce70562695b5ab45e50856201ae812179a1818152f52f7a877750'

          assert.strict.equal(script, expectedScript)
        })
      })

      describe('Document creation', () => {
	let getCurrentMinerIdAlias, getMinerIdPublicKey, getPreviousMinerIdAlias
	let readPrevRevocationKeyPublicKeyFromFile, readRevocationKeyPublicKeyFromFile
	let readPrevRevocationKeySigFromFile, readOptionalMinerIdData
	let signStub, unset, minerIdSigPayload

        beforeEach(() => {
          sinon.stub(console, "log")
          getCurrentMinerIdAlias = sandbox.stub(fm, 'getCurrentMinerIdAlias').returns('unittest_1')
          getMinerIdPublicKey = sandbox.stub(fm, 'getMinerIdPublicKey').returns('02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab')
          getPreviousMinerIdAlias = sandbox.stub(fm, 'getPreviousMinerIdAlias').returns('unittest_1')
	  readPrevRevocationKeyPublicKeyFromFile = sandbox.stub(fm, 'readPrevRevocationKeyPublicKeyFromFile').returns('02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411')
	  readRevocationKeyPublicKeyFromFile = sandbox.stub(fm, 'readRevocationKeyPublicKeyFromFile').returns('02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411')
	  readPrevRevocationKeySigFromFile = sandbox.stub(fm, 'readPrevRevocationKeySigFromFile').returns('30430220377c9bfa51290dd57f56568722c8f8e9d6522977246cb69c5e8bd3f4ce8c1fd0021f0cdb5d979dc083afaab270385386fd4b5dc6d165594aedafe0afd5f8d1a6ee')
          readOptionalMinerIdData = sandbox.stub(fm, 'readOptionalMinerIdData').returns({})

          const signObj = { sign: coinbaseDocService.__get__('sign') }
          signStub = sandbox.stub(signObj, 'sign').returns({})
          unset = coinbaseDocService.__set__('sign', signStub)

          const createMinerInfoDocument = coinbaseDocService.__get__('createMinerInfoDocument')

          createMinerInfoDocument('unittest', 1234)

          minerIdSigPayload = Buffer.concat([
            Buffer.from('02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab', 'hex'),
            Buffer.from('02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab', 'hex')
          ])
        })
        afterEach(() => {
          unset()
          console.log.restore()
        })

	// Checks if the expected functions were called.
        it('calls "getCurrentMinerIdAlias" with right parameters', () => {
          expect(getCurrentMinerIdAlias.calledWith('unittest')).to.be(true)
        })

        it('calls "getMinerIdPublicKey" with right parameters', () => {
          expect(getMinerIdPublicKey.calledWith('unittest_1')).to.be(true)
        })

        it('calls "getPreviousMinerIdAlias" with right parameters', () => {
          expect(getPreviousMinerIdAlias.calledWith('unittest')).to.be(true)
        })

        it('calls "readPrevRevocationKeyPublicKeyFromFile" with right parameters', () => {
          expect(readPrevRevocationKeyPublicKeyFromFile.calledWith('unittest')).to.be(true)
        })

        it('calls "readRevocationKeyPublicKeyFromFile" with right parameters', () => {
          expect(readRevocationKeyPublicKeyFromFile.calledWith('unittest')).to.be(true)
        })

        it('calls "readPrevRevocationKeySigFromFile" with right parameters', () => {
          expect(readPrevRevocationKeySigFromFile.calledWith('unittest')).to.be(true)
        })

        it('calls "readOptionalMinerIdData" with right parameters', () => {
          expect(readOptionalMinerIdData.calledWith('unittest')).to.be(true)
        })

        it('calls "sign" with right parameters', () => {
          expect(signStub.calledWith(minerIdSigPayload, 'unittest_1')).to.be(true)
        })
      })
    })
  })

  /**
   * Dynamic document creation.
   */
  describe('Dynamic document creation / Directories mocked (.minerid-client, .keystore & .revocationkeystore)', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]',
	  revocationKeyData: '{ "prevRevocationKey": "02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411", "revocationKey": "02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411", "prevRevocationKeySig": "30430220377c9bfa51290dd57f56568722c8f8e9d6522977246cb69c5e8bd3f4ce8c1fd0021f0cdb5d979dc083afaab270385386fd4b5dc6d165594aedafe0afd5f8d1a6ee" }'
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2EikiPVYtLM8sUrBeiuJqKFyAzEWyqjyvDwqFt3mtkHvfHjx7276nxnqsqm8VNtiwQZXXo5TK5N7Zy4NycaDdhBYCEMHJbk'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2MuFMBEMccXsxoz5ShrhQceN32Ycm9j1NrjgRR6AEtocCS83miARoEXpU9rC4UqRvyUjmjvaHzZECZdSYzxSfxAeykBsg92'
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

    it('can create miner-info OP_RETURN script for "unittest"', async () => {
      assert.strict.deepEqual(await coinbaseDocService.createMinerInfoOpReturn(100, 'unittest'),'006a04601dface01004db4027b2276657273696f6e223a22302e33222c22686569676874223a3130302c22707265764d696e65724964223a22303366613538633234643334666564666436623366643034393066653362636233366462326264643664636363643666383437353361633664613865393164653566222c22707265764d696e65724964536967223a2233303435303232313030626461356539633630373230313637363437386138386565303733316162313465343865366661643833323133383662343134616432366536343035363730653032323036636435373266393962643263356366386466346337303736383237316562326365333364393532636234663430346432376161623864313265366136323035222c226d696e65724964223a22303366613538633234643334666564666436623366643034393066653362636233366462326264643664636363643666383437353361633664613865393164653566222c22707265765265766f636174696f6e4b6579223a22303266613463613036326534306539633930396161376430353339616237623037393065353534353035643761323939326266393762316664633761346133343131222c227265766f636174696f6e4b6579223a22303266613463613036326534306539633930396161376430353339616237623037393065353534353035643761323939326266393762316664633761346133343131222c22707265765265766f636174696f6e4b6579536967223a22333034333032323033373763396266613531323930646435376635363536383732326338663865396436353232393737323436636236396335653862643366346365386331666430303231663063646235643937396463303833616661616232373033383533383666643462356463366431363535393461656461666530616664356638643161366565227d473045022100819a03d3838bec280be1105c290c29dcab49d9a458f429eb2ed4f696733958ec02207e599b50e88bc555f9db840f2707b3e3105df5dd97d09a8501f506c8e0019c64')
    })

    it('can create coinbase OP_RETURN script', async () => {
      assert.strict.deepEqual(mi.createCoinbaseOpReturnScript('f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16').toHex(), '006a04601dface010020f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16')
    })

    it('can create coinbase OP_RETURN script 2', async () => {
      const createCoinbaseOpReturnScript2 = mi.__get__('createCoinbaseOpReturnScript2')
      assert.strict.deepEqual(createCoinbaseOpReturnScript2('f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16', '8dc30de84e6c500d4394f9330d456ddd765dba1d58c34480d306cd6300aa58e2', '3045022100cb244bc05b80bd37682c68eae93dd532d75dff2c33fc0bf43c33130d3542cb71022073d08f8db46a51d1e8490b874b61aa36ab1c7040598f55984cb99de2e2f3003e').toHex(), '006a04601dface010020f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16208dc30de84e6c500d4394f9330d456ddd765dba1d58c34480d306cd6300aa58e2473045022100cb244bc05b80bd37682c68eae93dd532d75dff2c33fc0bf43c33130d3542cb71022073d08f8db46a51d1e8490b874b61aa36ab1c7040598f55984cb99de2e2f3003e')
    })

    it('can create coinbase2 for "unittest"', async () => {
      const createCoinbase2 = coinbaseDocService.__get__('createCoinbase2')
      assert.strict.deepEqual(await createCoinbase2('unittest', 'f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16', '000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47', [], 'ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000'), 'ffffffff021a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac000000000000000093006a04601dface010020f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e1620f58a869ac5a6fa09b8020e082d4cca41102a5685ceed87a6748e771c0a98bb544730450221009360acd72927843a52b6df1c4732420a80b72a026c292e35165e01ef409227510220770bf52e1cd6ed72847313747213acedd8d857eeae52fa23db6935189f06050100000000')
    })
  })

  describe('Static document / Directories mocked (.minerid-client, .keystore & .revocationkeystore)', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]'
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

        it('signWithCurrentMinerId is calling getCurrentMinerIdAlias and signHash with the right parameters', () => {
          const getCurrentMinerIdAlias = sandbox.stub(fm, 'getCurrentMinerIdAlias').returns('unittest_1')

          const hash = 'b391347e78e93f05547c6a643dba2ea7df50effdf40061152fab922cbbbef072'

          const signWithCurrentMinerId = coinbaseDocService.__get__('signWithCurrentMinerId')
          signWithCurrentMinerId(hash, 'unittest')

          expect(getCurrentMinerIdAlias.calledWith('unittest')).to.be(true)
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

    describe('Verify an initial miner info document', function () {
      let docHex, sigHex
      const sampleDoc = {
        'version': '0.3',
        'height': 100,
        'prevMinerId': '03fa58c24d34fedfd6b3fd0490fe3bcb36db2bdd6dcccd6f84753ac6da8e91de5f',
        'prevMinerIdSig': '3045022100bda5e9c607201676478a88ee0731ab14e48e6fad8321386b414ad26e6405670e02206cd572f99bd2c5cf8df4c70768271eb2ce33d952cb4f404d27aab8d12e6a6205',
        'minerId': '03fa58c24d34fedfd6b3fd0490fe3bcb36db2bdd6dcccd6f84753ac6da8e91de5f',
        'prevRevocationKey': '02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411',
        'revocationKey': '02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411',
        'prevRevocationKeySig': '30430220377c9bfa51290dd57f56568722c8f8e9d6522977246cb69c5e8bd3f4ce8c1fd0021f0cdb5d979dc083afaab270385386fd4b5dc6d165594aedafe0afd5f8d1a6ee',
        'minerContact': {
                'email': 'test@testDomain.com',
                'name': 'test',
                'phone': '07495380665'
        },
        'extensions': {
        	'ext1': 1,
        	'ext2': 2,
        	'ext3': {
        		'ext3_1': 1
        	}
        }
      }

      before(async () => {
        sinon.stub(console, "log")
        sinon.stub(console, "debug")

        mock({
          [`${os.homedir()}/.minerid-client/unittest`]: {
            aliases: '[ { "name": "unittest_1" } ]',
            minerIdOptionalData: `{
        		"minerContact": {
                                "email": "test@testDomain.com",
                                "name": "test",
                                "phone": "07495380665"
        		},
        		"extensions": {
                                "ext1": 1,
                                "ext2": 2,
                                "ext3": {
                                        "ext3_1": 1
        			}
        		}
                    }`,
            revocationKeyData: '{ "prevRevocationKey": "02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411", "revocationKey": "02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411", "prevRevocationKeySig": "30430220377c9bfa51290dd57f56568722c8f8e9d6522977246cb69c5e8bd3f4ce8c1fd0021f0cdb5d979dc083afaab270385386fd4b5dc6d165594aedafe0afd5f8d1a6ee" }'
          },
          [`${os.homedir()}/.keystore`]: {
            'unittest_1.key': 'xprv9s21ZrQH143K2EikiPVYtLM8sUrBeiuJqKFyAzEWyqjyvDwqFt3mtkHvfHjx7276nxnqsqm8VNtiwQZXXo5TK5N7Zy4NycaDdhBYCEMHJbk'
          },
          [`${os.homedir()}/.revocationkeystore`]: {
            'unittest_1.key': 'xprv9s21ZrQH143K2MuFMBEMccXsxoz5ShrhQceN32Ycm9j1NrjgRR6AEtocCS83miARoEXpU9rC4UqRvyUjmjvaHzZECZdSYzxSfxAeykBsg92'
          }
        })

        const opReturn = await coinbaseDocService.createMinerInfoOpReturn(
          100,
          'unittest'
        )
        const script = bsv.Script.fromHex(opReturn)
        const outputParts = script.toASM().split(' ')
        // ignore first 4 parts: OP_FALSE OP_RETURN -149757612 (minerId prefix) 0x00 (protocol-id-version)
        docHex = outputParts[4]
        sigHex = outputParts[5]
      })

      after(async () => {
        mock.restore()
        console.log.restore()
        console.debug.restore()
      })

      describe('prevMinerIdSig & prevRevocationKeySig', function () {
        it('can verify signatures', () => {
          // prevMinerIdSig
          {
             const minerIdSigPayload = Buffer.concat([
                Buffer.from(sampleDoc.prevMinerId, 'hex'),
                Buffer.from(sampleDoc.minerId, 'hex')
             ])

             const hashbuf = bsv.crypto.Hash.sha256(minerIdSigPayload)
             const sig = bsv.crypto.Signature.fromString(sampleDoc.prevMinerIdSig)
             const pubkey = bsv.PublicKey.fromString(sampleDoc.prevMinerId)
             const verified = bsv.crypto.ECDSA.verify(hashbuf, sig, pubkey)

             assert.strictEqual(verified, true)
          }
          // prevRevocationKeySig
          {
             const revocationKeySigPayload = Buffer.concat([
                Buffer.from(sampleDoc.prevRevocationKey, 'hex'),
                Buffer.from(sampleDoc.revocationKey, 'hex')
             ])
             const hashbuf = bsv.crypto.Hash.sha256(revocationKeySigPayload)
             const sig = bsv.crypto.Signature.fromString(sampleDoc.prevRevocationKeySig)
             const pubkey = bsv.PublicKey.fromString(sampleDoc.prevRevocationKey)
             const verified = bsv.crypto.ECDSA.verify(hashbuf, sig, pubkey)
             assert.strictEqual(verified, true)
          }
        })
      })

      describe('Miner-info document', function () {
        it('can verify using the full miner info document', async () => {
          const doc = Buffer.from(docHex, 'hex')
          assert.strictEqual(doc.toString(), JSON.stringify(sampleDoc))

          const docJson = JSON.parse(doc.toString())
          const minerId = docJson.minerId

          const hashbuf = bsv.crypto.Hash.sha256(doc)
          const sig = bsv.crypto.Signature.fromString(sigHex)
          const pubkey = bsv.PublicKey.fromString(minerId)
          const verified = bsv.crypto.ECDSA.verify(hashbuf, sig, pubkey)

          assert.strictEqual(verified, true)
        })
      })
    })

    describe('Verify a miner-info document with rotated keys', function () {
      let docHex, sigHex
      const sampleDoc = {
        'version': '0.3',
        'height': 101,
        'prevMinerId': '03fa58c24d34fedfd6b3fd0490fe3bcb36db2bdd6dcccd6f84753ac6da8e91de5f',
        'prevMinerIdSig': '304402206f8b67b731ba317b6f35dc0d53d33b86bec3cb28789e32bd839c183c8af88b29022013f817cef1afcf934ac73a6d61cef368abf3b03dfe489ce9a94db142f589971b',
        'minerId': '0215c65cd589a42b3d2e58831621f4b93c8f85bd6bba6f00a0a4ca7f7d84e3937d',
        'prevRevocationKey': '02fa4ca062e40e9c909aa7d0539ab7b0790e554505d7a2992bf97b1fdc7a4a3411',
        'revocationKey': '0388c79d310bb82449a6c78262a00e15dfcc27ed88c77548a489900e0acee14370',
        'prevRevocationKeySig': '304402202f41130334e76dee5de4e7b004e26cb5f3f068f1e928de370d68e992f7cf801102202a38ecdc2dc876d3ed660a54cd96c67038193182453e245499a831054056d59d'
      }

      beforeEach(async () => {
        mock({
          [`${os.homedir()}/.minerid-client/unittest`]: {
	    aliases: '[ { "name": "unittest_1" }, { "name": "unittest_2" } ]',
            revocationKeyAliases: '[ { "name": "unittest_1" }, { "name": "unittest_2" } ]'
          },
          [`${os.homedir()}/.keystore`]: {
            'unittest_1.key': 'xprv9s21ZrQH143K2EikiPVYtLM8sUrBeiuJqKFyAzEWyqjyvDwqFt3mtkHvfHjx7276nxnqsqm8VNtiwQZXXo5TK5N7Zy4NycaDdhBYCEMHJbk',
            'unittest_2.key': 'xprv9s21ZrQH143K4Degit4vEjkrVZv31rjqfMpFDXq64nNV3MWYHwxgtMLYSiVy1UASsSntxz5RtLmE1wm7iN2SvwNwiuwVhGeunEDNC1o5hwk'
          },
          [`${os.homedir()}/.revocationkeystore`]: {
            'unittest_1.key': 'xprv9s21ZrQH143K2MuFMBEMccXsxoz5ShrhQceN32Ycm9j1NrjgRR6AEtocCS83miARoEXpU9rC4UqRvyUjmjvaHzZECZdSYzxSfxAeykBsg92',
            'unittest_2.key': 'xprv9s21ZrQH143K2c9ejaeTCzpkECHv2SoPMZ8B4hm7vnmzivQpoHU3JcFAYKZgLzfrFXSEp5Wv6iGWVTh2qAnLcPdStNtF7nrtHxvqM41uKBe'
          }
        })
      })

      afterEach(() => {
        mock.restore()
      })

      it('can verify prevMinerId', () => {
	  const expPrevMinerIdPrivateKey = new bsv.HDPrivateKey('xprv9s21ZrQH143K2EikiPVYtLM8sUrBeiuJqKFyAzEWyqjyvDwqFt3mtkHvfHjx7276nxnqsqm8VNtiwQZXXo5TK5N7Zy4NycaDdhBYCEMHJbk').privateKey
	  const prevMinerIdAlias = fm.getPreviousMinerIdAlias('unittest')
	  assert.strictEqual(prevMinerIdAlias, 'unittest_1')
	  assert.strict.deepEqual(fm.getMinerIdPrivateKey(prevMinerIdAlias), expPrevMinerIdPrivateKey)
	  assert.strictEqual(fm.getMinerIdPublicKey(prevMinerIdAlias), sampleDoc.prevMinerId)
      })

      it('can verify minerId', () => {
	  const expMinerIdPrivateKey = new bsv.HDPrivateKey('xprv9s21ZrQH143K4Degit4vEjkrVZv31rjqfMpFDXq64nNV3MWYHwxgtMLYSiVy1UASsSntxz5RtLmE1wm7iN2SvwNwiuwVhGeunEDNC1o5hwk').privateKey
	  const minerIdAlias = fm.getCurrentMinerIdAlias('unittest')
	  assert.strictEqual(minerIdAlias, 'unittest_2')
	  assert.strict.deepEqual(fm.getMinerIdPrivateKey(minerIdAlias), expMinerIdPrivateKey)
	  assert.strictEqual(fm.getMinerIdPublicKey(minerIdAlias), sampleDoc.minerId)
	  assert.notEqual(sampleDoc.minerId, sampleDoc.prevMinerId)
      })

      it('can verify prevRevocationKey', () => {
	  const expPrevRevocationKeyPrivateKey = new bsv.HDPrivateKey('xprv9s21ZrQH143K2MuFMBEMccXsxoz5ShrhQceN32Ycm9j1NrjgRR6AEtocCS83miARoEXpU9rC4UqRvyUjmjvaHzZECZdSYzxSfxAeykBsg92').privateKey
	  const prevRevocationKeyAlias = fm.getPreviousRevocationKeyAlias('unittest')
	  assert.strictEqual(prevRevocationKeyAlias, 'unittest_1')
	  assert.strict.deepEqual(fm.getRevocationKeyPrivateKey(prevRevocationKeyAlias), expPrevRevocationKeyPrivateKey)
	  assert.strictEqual(fm.getRevocationKeyPublicKey(prevRevocationKeyAlias), sampleDoc.prevRevocationKey)
      })

      it('can verify revocationKey', () => {
	  const expRevocationKeyPrivateKey = new bsv.HDPrivateKey('xprv9s21ZrQH143K2c9ejaeTCzpkECHv2SoPMZ8B4hm7vnmzivQpoHU3JcFAYKZgLzfrFXSEp5Wv6iGWVTh2qAnLcPdStNtF7nrtHxvqM41uKBe').privateKey
	  const revocationKeyAlias = fm.getCurrentRevocationKeyAlias('unittest')
	  assert.strictEqual(revocationKeyAlias, 'unittest_2')
	  assert.strict.deepEqual(fm.getRevocationKeyPrivateKey(revocationKeyAlias), expRevocationKeyPrivateKey)
	  assert.strictEqual(fm.getRevocationKeyPublicKey(revocationKeyAlias), sampleDoc.revocationKey)
	  assert.notEqual(sampleDoc.revocationKey, sampleDoc.prevRevocationKey)
      })

      it('can verify prevMinerIdSig signature', () => {
          const prevMinerIdSigPayload = Buffer.concat([
             Buffer.from(sampleDoc.prevMinerId, 'hex'),
             Buffer.from(sampleDoc.minerId, 'hex')
          ])
          // recreate signature
          const hash = bsv.crypto.Hash.sha256(prevMinerIdSigPayload)
          const prevMinerIdPrivateKey = fm.getMinerIdPrivateKey(fm.getPreviousMinerIdAlias('unittest'))
          const prevMinerIdSig = bsv.crypto.ECDSA.sign(hash, prevMinerIdPrivateKey)
          assert.strictEqual(prevMinerIdSig.toString(), sampleDoc.prevMinerIdSig)
          // verify signature from the sampleDoc
          const actualPrevMinerIdSig = bsv.crypto.Signature.fromString(sampleDoc.prevMinerIdSig)
          const prevMinerIdPublicKey = bsv.PublicKey.fromString(sampleDoc.prevMinerId)
          const verified = bsv.crypto.ECDSA.verify(hash, actualPrevMinerIdSig, prevMinerIdPublicKey)
          assert.strictEqual(verified, true)
      })
      it('can verify prevRevocationKeySig signature', () => {
          const prevRevocationKeySigPayload = Buffer.concat([
             Buffer.from(sampleDoc.prevRevocationKey, 'hex'),
             Buffer.from(sampleDoc.revocationKey, 'hex')
          ])
          // recreate signature
          const hash = bsv.crypto.Hash.sha256(prevRevocationKeySigPayload)
          const prevRevocationKeyPrivateKey = fm.getRevocationKeyPrivateKey(fm.getPreviousRevocationKeyAlias('unittest'))
          const prevRevocationKeySig = bsv.crypto.ECDSA.sign(hash, prevRevocationKeyPrivateKey)
          assert.strictEqual(prevRevocationKeySig.toString(), sampleDoc.prevRevocationKeySig)
          // verify signature from the sampleDoc
          const actualPrevRevocationKeySig = bsv.crypto.Signature.fromString(sampleDoc.prevRevocationKeySig)
          const prevRevocationKeyPublicKey = bsv.PublicKey.fromString(sampleDoc.prevRevocationKey)
          const verified = bsv.crypto.ECDSA.verify(hash, actualPrevRevocationKeySig, prevRevocationKeyPublicKey)
          assert.strictEqual(verified, true)
      })
    })
  })
})
