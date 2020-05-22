const addext = require('./services/extensions')

const miningCandidate = {
  'id': '7304003d-cb8e-4b4f-9695-0f2b1844f261',
  'prevhash': '35d696d221acbf046283f501f7a7cbc52a147d8d9c97ce1739e76933bbdf7a1a',
  'coinbaseValue': 5000000792,
  'version': 536870912,
  'nBits': '207fffff',
  'time': 1590063803,
  'height': 103,
  'num_tx': 4,
  'sizeWithoutCoinbase': 871,
  'merkleProof': [
    '3f5281c83887757b52af54e5855626a1012f864183cd28fc05d1aff6f0357dd9',
    'e842e282b7d244b3468bbf7b53fb48ff5eba29b2fd53e02db5a90cd2b57b6bcb'
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

const extensions = addext({}, extensionData)
console.log(extensions)
