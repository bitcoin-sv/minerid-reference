const bsv = require('bsv')

function addBlockBind (extensionData) {
  if (!extensionData || !extensionData.hasOwnProperty('miningCandidate')) {
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
    // .to(address, 1250000000) // TODO: add minerAddress
    .addOutput(emptyDataOutput)

  const modifiedMerkleRoot = buildMerkleRootFromCoinbase(tx.id, extensionData.miningCandidate.merkleProof)

  return {
    prevBlockHash: extensionData.miningCandidate.prevhash,
    modifiedMerkleRoot: modifiedMerkleRoot
  }
}

function buildMerkleRootFromCoinbase (coinbaseHash, merkleBranches) {
  // merkleBranches = merkleBranches.reverse()

  let res = coinbaseHash
  merkleBranches.forEach(merkleBranch => {
    let concat = res.concat(merkleBranch)
    res = bsv.crypto.Hash.sha256sha256(Buffer.from(concat, 'hex')).toString('hex')
  })
  return res
}

module.exports = addBlockBind
