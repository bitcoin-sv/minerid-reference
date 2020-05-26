const addext = require('./services/extensions')

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

let extensionData = {}
extensionData.miningCandidate = miningCandidate
extensionData.feeSpec = feeSpec
extensionData.getInfo = getInfo

const extensions = addext(extensionData)
console.log(extensions)
