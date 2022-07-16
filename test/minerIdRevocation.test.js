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

describe('Revoke minerId', function () {
  // The initial miner-info document (the 'version' and 'height' fields are skipped in the example for simplicity).
  let firstMinerIdDoc = `{
    "prevMinerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e",
    "prevMinerIdSig": "304402201bd741fa7096555a16f2c97849614649852ea8b3bdc43d43422a2ef340e565e0022002383f756704c7ca17d1a962756124017e21e5e8220cb412f6f07c459f3058e1",
    "minerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e",
    "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd",
    "revocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd",
    "prevRevocationKeySig": "304402205da7a781aefca1e3019d0bf2fb9d936bd5cc9bdbe2e4905c74885224525fd1fd02201337413a079405cc7d64e95762857e94eeb151561175df90607c29a943f53245"
  }`
  const firstDoc = JSON.parse(firstMinerIdDoc)

  function checkMinerIdRevocationMessageAndSig (minerIdRevocationData, compromisedMinerId, minerIdPrivateKey) {
     // Check minerId revocation data.
     assert.strictEqual(minerIdRevocationData.revocationMessage["compromised_minerId"], compromisedMinerId)
     const expRevocationMessagePayload = Buffer.concat([
       Buffer.from(minerIdRevocationData.revocationMessage["compromised_minerId"], 'hex')
     ])
     const expRevocationMessageHash = bsv.crypto.Hash.sha256(expRevocationMessagePayload)
     const expRevocationMessageSig1 = bsv.crypto.ECDSA.sign(expRevocationMessageHash, fm.getRevocationKeyPrivateKey(fm.getCurrentRevocationKeyAlias('unittest')))
     //const expRevocationMessageSig2 = bsv.crypto.ECDSA.sign(expRevocationMessageHash, fm.getMinerIdPrivateKey(fm.getCurrentMinerIdAlias('unittest')))
     const expRevocationMessageSig2 = bsv.crypto.ECDSA.sign(expRevocationMessageHash, minerIdPrivateKey)
     assert.strictEqual(minerIdRevocationData.revocationMessageSig["sig1"], expRevocationMessageSig1.toString('hex'))
     assert.strictEqual(minerIdRevocationData.revocationMessageSig["sig2"], expRevocationMessageSig2.toString('hex'))
     // Check if the miner-info revocation document contains minerId revocation data.
     const createMinerInfoDocument = coinbaseDocService.__get__('createMinerInfoDocument')
     const minerIdRevocationDoc = createMinerInfoDocument('unittest', 101 /* a dummy height */)
     assert.strictEqual(minerIdRevocationDoc.revocationMessage["compromised_minerId"], minerIdRevocationData.revocationMessage["compromised_minerId"])
     assert.strictEqual(minerIdRevocationDoc.revocationMessageSig["sig1"], minerIdRevocationData.revocationMessageSig["sig1"])
     assert.strictEqual(minerIdRevocationDoc.revocationMessageSig["sig2"], minerIdRevocationData.revocationMessageSig["sig2"])
  }

  function checkPrevMinerIdSig (prevMinerId, minerId, actualPrevMinerIdSig) {
     const expPrevMinerIdSigPayload = Buffer.concat([
       Buffer.from(prevMinerId, 'hex'),
       Buffer.from(minerId, 'hex')
     ])
     const expPrevMinerIdSigPayloadHash = bsv.crypto.Hash.sha256(expPrevMinerIdSigPayload)
     const expPrevMinerIdSig = bsv.crypto.ECDSA.sign(expPrevMinerIdSigPayloadHash, fm.getMinerIdPrivateKey(fm.getPreviousMinerIdAlias('unittest')))
     assert.strictEqual(actualPrevMinerIdSig, expPrevMinerIdSig.toString('hex'))
  }

  // The input arguments represent the miner ID keys seen by the miner-info revocation document.
  function testPartialRevocation (initialMinerId, compromisedMinerId, expPrevMinerId) {
     function checkPartialMinerIdRevocationDoc (compromisedMinerId, expPrevMinerId, expMinerId, prevMinerIdPrivateKey) {
       const minerIdRevocationData = fm.readMinerIdRevocationDataFromFile('unittest')
       assert.strictEqual(minerIdRevocationData["complete_revocation"], false)
       checkMinerIdRevocationMessageAndSig(minerIdRevocationData, compromisedMinerId, prevMinerIdPrivateKey)
       // 'prevMinerId' != 'minerId'.
       const createMinerInfoDocument = coinbaseDocService.__get__('createMinerInfoDocument')
       const minerIdRevocationDoc = createMinerInfoDocument('unittest', 101 /* a dummy height */)
       assert.strictEqual(minerIdRevocationDoc.prevMinerId, expPrevMinerId)
       assert.strictEqual(minerIdRevocationDoc.minerId, expMinerId)
       assert.notEqual(expPrevMinerId, expMinerId)
       checkPrevMinerIdSig(minerIdRevocationDoc.prevMinerId, minerIdRevocationDoc.minerId, minerIdRevocationDoc.prevMinerIdSig)
     }
     assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["first_minerId"], initialMinerId)
     assert.strictEqual(coinbaseDocService.revokeMinerId('unittest', compromisedMinerId, false /* partial revocation */), true)
     // Use the previous miner ID private key associated with prevMinerId public key defined by the revocation document.
     const prevMinerIdPrivateKey = fm.getMinerIdPrivateKey(fm.getPreviousMinerIdAlias('unittest'))
     const currentMinerId = fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias('unittest')).toString('hex')
     checkPartialMinerIdRevocationDoc(compromisedMinerId, expPrevMinerId, currentMinerId, prevMinerIdPrivateKey)
  }

  // The input arguments represent the miner ID keys seen by the miner-info revocation document.
  // (1) The compromised minerId key is always the first minerId key used in the initial reputation chain.
  // (2) The miner-info revocation document sets 'prevMinerId' to the same value as 'minerId'.
  function testCompleteRevocation (compromisedMinerId, expMinerId) {
     function checkCompleteMinerIdRevocationDoc (compromisedMinerId, expMinerId, minerIdPrivateKey) {
       const minerIdRevocationData = fm.readMinerIdRevocationDataFromFile('unittest')
       assert.strictEqual(minerIdRevocationData["complete_revocation"], true)
       checkMinerIdRevocationMessageAndSig(minerIdRevocationData, compromisedMinerId, minerIdPrivateKey)
       // Check if the miner-info revocation document sets 'prevMinerId' to the same value as 'minerId' field.
       const createMinerInfoDocument = coinbaseDocService.__get__('createMinerInfoDocument')
       const minerIdRevocationDoc = createMinerInfoDocument('unittest', 101 /* a dummy height */)
       assert.strictEqual(minerIdRevocationDoc.prevMinerId, expMinerId)
       assert.strictEqual(minerIdRevocationDoc.minerId, expMinerId)
       checkPrevMinerIdSig(minerIdRevocationDoc.prevMinerId, minerIdRevocationDoc.minerId, minerIdRevocationDoc.prevMinerIdSig)
     }
     assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["first_minerId"], compromisedMinerId)
     assert.strictEqual(coinbaseDocService.revokeMinerId('unittest', compromisedMinerId, true /* complete revocation */), true)
     const minerIdPrivateKey = fm.getMinerIdPrivateKey(fm.getCurrentMinerIdAlias('unittest'))
     checkCompleteMinerIdRevocationDoc(compromisedMinerId, expMinerId, minerIdPrivateKey)
  }

  describe('Non-rotated minerId chain', function () {
    beforeEach(async () => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]',
          minerIdData: '{ "first_minerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e" }',
          revocationKeyData: '{ "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "revocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "prevRevocationKeySig": "304402205da7a781aefca1e3019d0bf2fb9d936bd5cc9bdbe2e4905c74885224525fd1fd02201337413a079405cc7d64e95762857e94eeb151561175df90607c29a943f53245" }',
          minerIdOptionalData: `{}`
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K4SmQL6XoUuFtQSoz3zd2zQAEoVcAeYkrmnewh3BJ326nZCJazvhRgsE6v8eb14hPcemGaycLxyKVqCRfD4teWmDWbD6DdhT'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2sLAnjFXEu39uNo48qW6wa2kVLq72GUqDPjrLAMavVtDbTzn4XDD2eYpwNd2RKmbe4GjTw8UcQBS4xscsn3KnCDQH8z6pw3'
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

    it('can verify that the partial revocation is not possible for the non-rotated chain', () => {
      assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["first_minerId"], firstDoc.minerId)
      // It's not possible to partially revoke a Miner ID reputation chain which is built up with a non-rotated minerId.
      assert.strictEqual(coinbaseDocService.revokeMinerId('unittest', firstDoc.minerId, false /* partial revocation */), false)
    })

    it('can verify that the complete revocation is possible for the non-rotated chain', () => {
      testCompleteRevocation(firstDoc.minerId, firstDoc.minerId)
    })
  })

  describe('Non-rotated minerId chain with rotated revocationKey', function () {
    beforeEach(async () => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" }, { "name": "unittest_2" } ]',
          minerIdData: '{ "first_minerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e" }',
          revocationKeyData: '{ "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "revocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "prevRevocationKeySig": "304402205da7a781aefca1e3019d0bf2fb9d936bd5cc9bdbe2e4905c74885224525fd1fd02201337413a079405cc7d64e95762857e94eeb151561175df90607c29a943f53245" }',
          minerIdOptionalData: `{}`
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K4SmQL6XoUuFtQSoz3zd2zQAEoVcAeYkrmnewh3BJ326nZCJazvhRgsE6v8eb14hPcemGaycLxyKVqCRfD4teWmDWbD6DdhT'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2sLAnjFXEu39uNo48qW6wa2kVLq72GUqDPjrLAMavVtDbTzn4XDD2eYpwNd2RKmbe4GjTw8UcQBS4xscsn3KnCDQH8z6pw3',
          'unittest_2.key': 'xprv9s21ZrQH143K3Lu5fLPEemJBgCfNyd96fNq1jbbPgbMYbSZKEfMHmNiLmSsC7RSfMCPMTaYcTQqmx2tDEpdMp6oaQXHjmNGHq4chUSiuSnj'
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

    it('can verify that the partial revocation is not possible for the non-rotated chain', () => {
      assert.strictEqual(fm.readMinerIdDataFromFile('unittest')["first_minerId"], firstDoc.minerId)
      // It's not possible to partially revoke a Miner ID reputation chain which is built up with a non-rotated minerId.
      assert.strictEqual(coinbaseDocService.revokeMinerId('unittest', firstDoc.minerId, false /* partial revocation */), false)
    })

    it('can verify that the complete revocation is possible for the non-rotated chain', () => {
      testCompleteRevocation(firstDoc.minerId, firstDoc.minerId)
    })
  })

  describe('Rotated minerId chain', function () {
    let rotatedMinerIdDoc = `{
      "prevMinerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e",
      "prevMinerIdSig": "3045022100b9426fe030fdfe39bbb6409ddecfa1ed511c1981e6c349975603bba386a6955202207fbda1525102bf1593429298aa756e1dab3faf550a63f81526858e459ae331a9",
      "minerId": "0222e1fe8b96e0d56657121d3f42cfd84ec45f88f9be9c61e1762d5d7cb1db7f38",
      "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd",
      "revocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd",
      "prevRevocationKeySig": "304402205da7a781aefca1e3019d0bf2fb9d936bd5cc9bdbe2e4905c74885224525fd1fd02201337413a079405cc7d64e95762857e94eeb151561175df90607c29a943f53245"
    }`
    const rotatedDoc = JSON.parse(rotatedMinerIdDoc)

    beforeEach(async () => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" }, { "name": "unittest_2" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" } ]',
          minerIdData: '{ "first_minerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e" }',
          revocationKeyData: '{ "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "revocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "prevRevocationKeySig": "304402205da7a781aefca1e3019d0bf2fb9d936bd5cc9bdbe2e4905c74885224525fd1fd02201337413a079405cc7d64e95762857e94eeb151561175df90607c29a943f53245" }',
          minerIdOptionalData: `{}`
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K4SmQL6XoUuFtQSoz3zd2zQAEoVcAeYkrmnewh3BJ326nZCJazvhRgsE6v8eb14hPcemGaycLxyKVqCRfD4teWmDWbD6DdhT',
          'unittest_2.key': 'xprv9s21ZrQH143K3F2uAaZMSRCrWeD8mJcxeVH2tkQx5FKWVoCsTp4qWmaMLLkaMUuytDG4Kff6TZxoL9kb29jgxiEy3LNNeMjEKz3NcfPn6ui'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2sLAnjFXEu39uNo48qW6wa2kVLq72GUqDPjrLAMavVtDbTzn4XDD2eYpwNd2RKmbe4GjTw8UcQBS4xscsn3KnCDQH8z6pw3'
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

    it('can verify the partial revocation', () => {
      testPartialRevocation (firstDoc.minerId, rotatedDoc.minerId, rotatedDoc.minerId)
    })

    it('can verify the complete revocation', () => {
      testCompleteRevocation(firstDoc.minerId, rotatedDoc.minerId)
    })
  })

  describe('Rotated minerId chain with rotated revocationKey', function () {
    let rotatedRevocationKeyDoc = `{
      "prevMinerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e",
      "prevMinerIdSig": "3045022100b9426fe030fdfe39bbb6409ddecfa1ed511c1981e6c349975603bba386a6955202207fbda1525102bf1593429298aa756e1dab3faf550a63f81526858e459ae331a9",
      "minerId": "0222e1fe8b96e0d56657121d3f42cfd84ec45f88f9be9c61e1762d5d7cb1db7f38",
      "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd",
      "revocationKey": "02e33e53d2de796201b2d50e0475898c68e59bcf8bef697c1d6eacfa01deae9fdf",
      "prevRevocationKeySig": "304402200bc2dd50155cc18cb2b000873dd11bfb87235b8bf8b57dc61722334068f711de02205ebff85c8a9a175a74adbc2e1a05cbdd293b203712551cbaedc8b375a1cbeacd"
    }`
    const rotatedDoc = JSON.parse(rotatedRevocationKeyDoc)

    beforeEach(async () => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" }, { "name": "unittest_2" } ]',
          revocationKeyAliases: '[ { "name": "unittest_1" }, { "name": "unittest_2" } ]',
          minerIdData: '{ "first_minerId": "02850442c6346d2ad8b457c9d7c0ac691ac14d61497750c27e389b8b6d62b2ac7e" }',
          revocationKeyData: '{ "prevRevocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "revocationKey": "03fe61b02a9ec52be67233e6c0d6acfb95ba5759d3df20edcd5ff723850f8b2fdd", "prevRevocationKeySig": "304402205da7a781aefca1e3019d0bf2fb9d936bd5cc9bdbe2e4905c74885224525fd1fd02201337413a079405cc7d64e95762857e94eeb151561175df90607c29a943f53245" }',
          minerIdOptionalData: `{}`
        },
        [`${os.homedir()}/.keystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K4SmQL6XoUuFtQSoz3zd2zQAEoVcAeYkrmnewh3BJ326nZCJazvhRgsE6v8eb14hPcemGaycLxyKVqCRfD4teWmDWbD6DdhT',
          'unittest_2.key': 'xprv9s21ZrQH143K3F2uAaZMSRCrWeD8mJcxeVH2tkQx5FKWVoCsTp4qWmaMLLkaMUuytDG4Kff6TZxoL9kb29jgxiEy3LNNeMjEKz3NcfPn6ui'
        },
        [`${os.homedir()}/.revocationkeystore`]: {
          'unittest_1.key': 'xprv9s21ZrQH143K2sLAnjFXEu39uNo48qW6wa2kVLq72GUqDPjrLAMavVtDbTzn4XDD2eYpwNd2RKmbe4GjTw8UcQBS4xscsn3KnCDQH8z6pw3',
          'unittest_2.key': 'xprv9s21ZrQH143K3Lu5fLPEemJBgCfNyd96fNq1jbbPgbMYbSZKEfMHmNiLmSsC7RSfMCPMTaYcTQqmx2tDEpdMp6oaQXHjmNGHq4chUSiuSnj'
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

    it('can verify the partial revocation', () => {
      testPartialRevocation (firstDoc.minerId, rotatedDoc.minerId, rotatedDoc.minerId)
    })

    it('can verify the complete revocation', () => {
      testCompleteRevocation(firstDoc.minerId, rotatedDoc.minerId)
    })
  })
})
