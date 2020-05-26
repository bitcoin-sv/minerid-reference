const bsv = require('bsv')
const { swapEndianness } = require('buffer-swap-endianness')

function addBlockBind ({ extensions = {}, jobData = {} }) {
  if (!jobData.miningCandidate) {
    return
  }

  // Create modified coinbase tx
  const coinbaseInput = new bsv.Transaction.Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xFFFFFFFF,
    script: new bsv.Script('0000000000000000')
  })

  const emptyDataOutput = new bsv.Transaction.Output({
    script: bsv.Script('006a'),
    satoshis: 0
  })

  const tx = new bsv.Transaction()
    .uncheckedAddInput(coinbaseInput)
    // .to(address, jobData.miningCandidate.coinbaseValue) // TODO: add minerAddress
    .addOutput(emptyDataOutput)

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
    let concat = Buffer.concat([res, merkleBranch])
    res = bsv.crypto.Hash.sha256sha256(concat)
  })

  return swapEndianness(Buffer.from(res, 'hex')).toString('hex') // swap endianness at the end
}

module.exports = addBlockBind
