const rewire = require('rewire')
const blockbind = rewire('../plugins/blockbind')
const blockinfo = rewire('../plugins/blockinfo')
const feespec = rewire('../plugins/feespec')
const minerparams = rewire('../plugins/minerparams')
const addExtensions = require('../services/extensions')

const clonedeep = require('lodash.clonedeep')

const { describe, it } = require('mocha')
const assert = require('assert')

describe('Extensions', function () {
  describe('BlockBind', function () {
    it('can create a Merkle root from coinbase1 and coinbase2 and no merkle branches', () => {
      const jobData = {
        coinbase1: '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff1c03d3b6092f7376706f6f6c2e636f6d2f',
        coinbase2: 'ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000',
        miningCandidate: {
          prevhash: '000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47',
          merkleProof: []
        }
      }

      const addBlockBind = blockbind.__get__('addBlockBind')
      const extensions = {}
      addBlockBind({ extensions, jobData })

      const expectedRoot = '6cbb34f7965514786ed041e021f447d228bb2a24531e225da1450b0ebbcf01bf'
      assert.strict.equal(extensions.blockbind.modifiedMerkleRoot, expectedRoot)
    })

    it('can create a Merkle root from coinbase1 and coinbase2 and 2 Merkle branches', () => {
      const jobData = {
        coinbase1: '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff1c03d3b6092f7376706f6f6c2e636f6d2f',
        coinbase2: 'ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000',
        miningCandidate: {
          prevhash: '000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47',
          merkleProof: [
            'd4298cf4e2199228af168ad6a998e5bd656cdc7776b8151c37066983b6367a45',
            '887ed2c1fcabb86c70fbfdf2bed3fe8760448ca3cac10ed203e67225505fc750'
          ]
        }
      }

      const addBlockBind = blockbind.__get__('addBlockBind')
      const extensions = {}
      addBlockBind({ extensions, jobData })

      const expectedRoot = '7aeea7a526c87d4dc4c56634bcaf19d7cdd1cdeb7f37db0cf8402b94f69462cd'
      assert.strict.equal(extensions.blockbind.modifiedMerkleRoot, expectedRoot)
    })

    it('can create a Merkle root from coinbase hash and 5 Merkle branches', () => {
      const expectedRoot = '4613bbcb10e2d0192bc2f226baf2a973842bdb47053ecca90d8d4540ec5ec4c0'

      const coinbaseHash = '66140d22ba975c50f7383618a4ac7ca5dab919ae4e43f88b0ee79b7cbcccb25a'
      const merkleBranches = [ // merkleProof in getminingcandidate BitCoin RPC call
        // see: https://github.com/bitcoin-sv-specs/protocol/blob/master/rpc/GetMiningCandidate.md
        '801fc07c69466a2216c55c185b69138fd98eb640abced94114868eada3adf180',
        'c1d8cec3243f0c689bc48545cf843e59c1efc859811024587defb9948fd76c18',
        'ffa3bf57d06df2dcf4158245b94f1211ea6b7e07690a099a6efd794eb7dbd5c4',
        'b558ea838bbc69498b3556c8ff85a2cd197b7295c1bd798308be2be53e940928',
        'dc93ffd1aec55cb7e030d3c22bb176ab2e991181fdc38e1c242132bd42e90e58'
      ]

      const buildMerkleRootFromCoinbase = blockbind.__get__('buildMerkleRootFromCoinbase')
      const merkleRoot = buildMerkleRootFromCoinbase(coinbaseHash, merkleBranches)

      assert.strict.equal(merkleRoot, expectedRoot)
    })

    it('can create a proper blockbind extension', () => {
      const jobData = {
        coinbase1: '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff1c03d3b6092f7376706f6f6c2e636f6d2f',
        coinbase2: 'ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000',
        miningCandidate: {
          prevhash: '000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47',
          merkleProof: [
            'd4298cf4e2199228af168ad6a998e5bd656cdc7776b8151c37066983b6367a45',
            '887ed2c1fcabb86c70fbfdf2bed3fe8760448ca3cac10ed203e67225505fc750'
          ]
        }
      }

      const addBlockBind = blockbind.__get__('addBlockBind')
      const extensions = {}
      addBlockBind({ extensions, jobData })

      const expectedBlockBind = {
        modifiedMerkleRoot: '7aeea7a526c87d4dc4c56634bcaf19d7cdd1cdeb7f37db0cf8402b94f69462cd',
        prevBlockHash: '000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47'
      }
      assert.strict.deepEqual(extensions.blockbind, expectedBlockBind)
    })
  })

  describe('BlockInfo', function () {
    it('can create a proper blockinfo extension', () => {
      const miningCandidate = {
        'id': 'e706b0e6-793b-448f-a1ae-8ef54459eb72',
        'prevhash': '70f5701644897c92b60e98dbbfe72e1cfd7a2728c6fa3a29c4b4f6e986b0ccaa',
        'coinbaseValue': 5000000974,
        'version': 536870912,
        'nBits': '207fffff',
        'time': 1590152467,
        'height': 106,
        'num_tx': 4,
        'sizeWithoutCoinbase': 1052,
        'merkleProof': [
          '9bd12ce6508574b3163aadb14eab7bd862306da85b221eb284fb41d6012db98f',
          '56f04cc78ac493defced65dd58f4437c67bcc697b59778b0cd96c3c64c1b0bbf'
        ]
      }
      const jobData = {
        miningCandidate: miningCandidate
      }

      const addBlockInfo = blockinfo.__get__('addBlockInfo')
      const extensions = {}
      addBlockInfo({ extensions, jobData })

      const expectedBlockInfo = {
        txCount: 4,
        blockSize: 1052
      }
      assert.strict.deepEqual(extensions.blockinfo, expectedBlockInfo)
    })
  })

  describe('FeeSpec', function () {
    it('can create a proper feespec extension', () => {
      const feeSpec = {
        'defaultFee': [
          {
            'feeType': 'standard',
            'miningFee': {
              'satoshis': 1,
              'bytes': 1
            },
            'relayFee': {
              'satoshis': 1,
              'bytes': 10
            }
          },
          {
            'feeType': 'data',
            'miningFee': {
              'satoshis': 2,
              'bytes': 1000
            },
            'relayFee': {
              'satoshis': 1,
              'bytes': 10000
            }
          }
        ]
      }
      const jobData = {
        feeSpec: feeSpec
      }

      const addFeeSpec = feespec.__get__('addFeeSpec')
      const extensions = {}
      addFeeSpec({ extensions, jobData })

      const expectedFeeSpec = {
        'defaultFee': [
          {
            'feeType': 'standard',
            'miningFee': {
              'satoshis': 1,
              'bytes': 1
            },
            'relayFee': {
              'satoshis': 1,
              'bytes': 10
            }
          },
          {
            'feeType': 'data',
            'miningFee': {
              'satoshis': 2,
              'bytes': 1000
            },
            'relayFee': {
              'satoshis': 1,
              'bytes': 10000
            }
          }
        ]
      }
      assert.strict.deepEqual(extensions.feeSpec, expectedFeeSpec)
    })
  })

  describe('MinerParams', function () {
    it('can create a proper minerparams extension', () => {
      const getInfo = {
        'version': 101000300,
        'protocolversion': 70015,
        'walletversion': 160300,
        'balance': 199.99997068,
        'blocks': 104,
        'timeoffset': 0,
        'connections': 4,
        'proxy': '',
        'difficulty': 4.656542373906925e-10,
        'testnet': false,
        'stn': false,
        'keypoololdest': 1575386196,
        'keypoolsize': 1999,
        'paytxfee': 0.00000000,
        'relayfee': 0.00000250,
        'errors': '',
        'maxblocksize': 9223372036854775807,
        'maxminedblocksize': 128000000,
        'maxstackmemoryusagepolicy': 100000000,
        'maxstackmemoryusageconsensus': 9223372036854775807
      }

      const jobData = {
        getInfo: getInfo
      }

      const addMinerParams = minerparams.__get__('addMinerParams')
      const extensions = {}
      addMinerParams({ extensions, jobData })

      const expectedMinerParams = {
        policy: {
          blockmaxsize: 9223372036854776000,
          maxstackmemoryusagepolicy: 100000000
        },
        consensus: {
          excessiveblocksize: 128000000,
          maxstackmemoryusageconsensus: 9223372036854776000
        }
      }
      assert.strict.deepEqual(extensions.minerparams, expectedMinerParams)
    })
  })

  describe('All Extensions', function () {
    const exampleDoc = {
      'version': '0.1',
      'height': 624455,
      'prevMinerId': '022604665d3a186be9690231a279f8e18b800f4ce78caac2d51940c8c1c92a8354',
      'prevMinerIdSig': '3044022067452f9d9baeef327183e2f565c8c4d76299287d6c0253aa133c75150d78d307022029c9d93ac08c19e20a03dc32307c4f0a023e79a505c02b01857c84d49670acf6',
      'minerId': '022604665d3a186be9690231a279f8e18b800f4ce78caac2d51940c8c1c92a8354',
      'vctx': {
        'txid': '6584f53e13216d34979098362bda34bd3677058c8b4e0621b24395c576b6baad',
        'vout': 0
      }
    }

    const exampleCoinbase1 = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff1c03deb7092f7376706f6f6c2e636f6d2f'
    const exampleCoinbase2 = 'ffffffff02a1705625000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac0000000000000000fd1302006a04ac1eed884dc1017b2276657273696f6e223a22302e31222c22686569676874223a22363336383934222c22707265764d696e65724964223a22303262336335636535326539646139633334363663353865656438383566343839653430346138386135656262626538663738623533616232366333636338613834222c22707265764d696e65724964536967223a223330343430323230376438623462666661663639303566356362626635623836643534646531326366383761366162383066353766633636386365666232643536646530616330303032323033313366343266666361653333343334646163636330376433303036376664343034623563616663626261373266383765666632343736386561333136313731222c226d696e65724964223a22303262336335636535326539646139633334363663353865656438383566343839653430346138386135656262626538663738623533616232366333636338613834222c2276637478223a7b2274784964223a2230346563613165333964393830653964376630613961323365656430386263656134663766313931613864336233383262393137363864343531636637396633222c22766f7574223a307d7d47304502210097adcb9e874c747ee9c821c0dbeb03a4ef9cf8dcaaba35783d71e762430063bc022017eb54ecb6b9f5fb175191c9c576ec86586d5f3496ebce8e91cdaf870c77743200000000'

    const miningCandidate = {
      'id': 'e706b0e6-793b-448f-a1ae-8ef54459eb72',
      'prevhash': '70f5701644897c92b60e98dbbfe72e1cfd7a2728c6fa3a29c4b4f6e986b0ccaa',
      'coinbaseValue': 5000000974,
      'version': 536870912,
      'nBits': '207fffff',
      'time': 1590152467,
      'height': 106,
      'num_tx': 4,
      'sizeWithoutCoinbase': 1052,
      'merkleProof': [
        '9bd12ce6508574b3163aadb14eab7bd862306da85b221eb284fb41d6012db98f',
        '56f04cc78ac493defced65dd58f4437c67bcc697b59778b0cd96c3c64c1b0bbf'
      ]
    }

    const getInfo = {
      'version': 101000300,
      'protocolversion': 70015,
      'walletversion': 160300,
      'balance': 199.99997068,
      'blocks': 104,
      'timeoffset': 0,
      'connections': 4,
      'proxy': '',
      'difficulty': 4.656542373906925e-10,
      'testnet': false,
      'stn': false,
      'keypoololdest': 1575386196,
      'keypoolsize': 1999,
      'paytxfee': 0.00000000,
      'relayfee': 0.00000250,
      'errors': '',
      'maxblocksize': 9223372036854775807, //
      'maxminedblocksize': 128000000, //
      'maxstackmemoryusagepolicy': 100000000, //
      'maxstackmemoryusageconsensus': 9223372036854775807 //
    }

    const feeSpec = {
      'defaultFee': [
        {
          'feeType': 'standard',
          'miningFee': {
            'satoshis': 1,
            'bytes': 1
          },
          'relayFee': {
            'satoshis': 1,
            'bytes': 10
          }
        },
        {
          'feeType': 'data',
          'miningFee': {
            'satoshis': 2,
            'bytes': 1000
          },
          'relayFee': {
            'satoshis': 1,
            'bytes': 10000
          }
        }
      ]
    }

    it('makes no changes to the coinbase document when no jobData is included', () => {
      let doc = clonedeep(exampleDoc)

      addExtensions(doc, '', '', {})

      assert.strict.deepEqual(doc, exampleDoc)
    })

    it('adds blockinfo extension when ONLY miningCandidate data is included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        miningCandidate: miningCandidate
      }

      addExtensions(doc, '', '', jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        blockinfo: {
          blockSize: 1052,
          txCount: 4
        }
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })

    it('adds minerparams extension when ONLY getInfo data is included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        getInfo: getInfo
      }

      addExtensions(doc, '', '', jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        minerparams: {
          policy: {
            blockmaxsize: 9223372036854776000,
            maxstackmemoryusagepolicy: 100000000
          },
          consensus: {
            excessiveblocksize: 128000000,
            maxstackmemoryusageconsensus: 9223372036854776000
          }
        }
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })

    it('adds feespec extension when ONLY feeSpec data is included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        feeSpec: feeSpec
      }

      addExtensions(doc, '', '', jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        feeSpec: feeSpec
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })

    it('adds blockinfo and blockbind extensions when cb1, cb2, and miningCandidate data are included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        miningCandidate: miningCandidate
      }

      addExtensions(doc, exampleCoinbase1, exampleCoinbase2, jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        blockinfo: {
          blockSize: 1052,
          txCount: 4
        },
        blockbind: {
          modifiedMerkleRoot: '112bc2f7714b5723d765453acb72399ffb70c8dcfabb3e9de7701da3a35d7849',
          prevBlockHash: '70f5701644897c92b60e98dbbfe72e1cfd7a2728c6fa3a29c4b4f6e986b0ccaa'
        }
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })

    it('adds minerparams extension when cb1, cb2, and getInfo data are included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        getInfo: getInfo
      }

      addExtensions(doc, exampleCoinbase1, exampleCoinbase2, jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        minerparams: {
          policy: {
            blockmaxsize: 9223372036854776000,
            maxstackmemoryusagepolicy: 100000000
          },
          consensus: {
            excessiveblocksize: 128000000,
            maxstackmemoryusageconsensus: 9223372036854776000
          }
        }
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })

    it('adds feespec extension when cb1, cb2, and feeSpec data are included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        feeSpec: feeSpec
      }

      addExtensions(doc, exampleCoinbase1, exampleCoinbase2, jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        feeSpec: feeSpec
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })

    it('adds all extensions when cb1, cb2, getInfo, miningCandidate, and feeSpec data are included in jobData', () => {
      let doc = clonedeep(exampleDoc)
      let jobData = {
        getInfo: getInfo,
        miningCandidate: miningCandidate,
        feeSpec: feeSpec
      }

      addExtensions(doc, exampleCoinbase1, exampleCoinbase2, jobData)

      let expectedDoc = clonedeep(exampleDoc)
      expectedDoc.extensions = {
        feeSpec: feeSpec,
        minerparams: {
          policy: {
            blockmaxsize: 9223372036854776000,
            maxstackmemoryusagepolicy: 100000000
          },
          consensus: {
            excessiveblocksize: 128000000,
            maxstackmemoryusageconsensus: 9223372036854776000
          }
        },
        blockinfo: {
          blockSize: 1052,
          txCount: 4
        },
        blockbind: {
          modifiedMerkleRoot: '112bc2f7714b5723d765453acb72399ffb70c8dcfabb3e9de7701da3a35d7849',
          prevBlockHash: '70f5701644897c92b60e98dbbfe72e1cfd7a2728c6fa3a29c4b4f6e986b0ccaa'
        }
      }

      assert.strict.deepEqual(doc, expectedDoc)
    })
  })
})
