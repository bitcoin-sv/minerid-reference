const bsv = require('bsv')
const { swapEndianness } = require('buffer-swap-endianness')
const { placeholderCB1 } = require('../services/extensions')

function addBlockBind ({ extensions = {}, jobData = {} }) {
  let { coinbase2, miningCandidate } = jobData

  if (!coinbase2) {
    return
  }

  if (!miningCandidate) {
    return
  }

  if (!Buffer.isBuffer(coinbase2)) {
    coinbase2 = Buffer.from(coinbase2, 'hex')
  }

  // placeholderCB1 is the zeroed out initial part of the coinbase shown in the blockbind BRFC
  // see: https://github.com/bitcoin-sv-specs/brfc-minerid/tree/master/extensions/blockbind
  const phCB1Buf = Buffer.from(placeholderCB1, 'hex')

  const cb = Buffer.concat([phCB1Buf, coinbase2])

  let tx
  try {
    tx = new bsv.Transaction(cb)
  } catch (error) {
    console.error('Error: invalid coinbase2: ', coinbase2)
    return
  }

  // add empty OP_RETURN output where the coinbase document (CBD) would go
  tx.addOutput(new bsv.Transaction.Output({
    script: bsv.Script('006a'),
    satoshis: 0
  }))

  const modifiedMerkleRoot = buildMerkleRootFromCoinbase(tx.id, jobData.miningCandidate.merkleProof)

  extensions.blockbind = {
    prevBlockHash: jobData.miningCandidate.prevhash,
    modifiedMerkleRoot: modifiedMerkleRoot
  }
}

function buildMerkleRootFromCoinbase (coinbaseHash, merkleBranches) {
  let res = swapEndianness(Buffer.from(coinbaseHash, 'hex')) // swap endianness before concatenating

  merkleBranches.forEach(merkleBranch => {
    merkleBranch = swapEndianness(Buffer.from(merkleBranch, 'hex')) // swap endianness before concatenating
    const concat = Buffer.concat([res, merkleBranch])
    res = bsv.crypto.Hash.sha256sha256(concat)
  })

  return swapEndianness(Buffer.from(res, 'hex')).toString('hex') // swap endianness at the end
}

module.exports = addBlockBind
