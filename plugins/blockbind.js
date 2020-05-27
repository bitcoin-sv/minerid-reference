const bsv = require('bsv')
const { swapEndianness } = require('buffer-swap-endianness')
const getPadding = require('../utils/getPadding')

function addBlockBind ({ extensions = {}, jobData = {} }) {
  let { coinbase1, coinbase2, miningCandidate } = jobData

  if (!coinbase1) {
    return
  }

  if (!coinbase2) {
    return
  }

  if (!miningCandidate) {
    return
  }

  if (!Buffer.isBuffer(coinbase1)) {
    coinbase1 = Buffer.from(coinbase1, 'hex')
  }

  if (!Buffer.isBuffer(coinbase2)) {
    coinbase2 = Buffer.from(coinbase2, 'hex')
  }

  const padding = getPadding(coinbase1)

  const cb = Buffer.concat([coinbase1, padding, coinbase2])

  const tx = new bsv.Transaction(cb)

  // Create modified coinbase tx
  tx.inputs[0] = new bsv.Transaction.Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xFFFFFFFF,
    script: new bsv.Script('0000000000000000')
  })

  let cbdExists = false
  tx.outputs.forEach((o, i) => {
    if (o.satoshis === 0 && o.script.toHex().match(/^(00){0,1}6a/)) { // find op return output
      cbdExists = true
      tx.outputs[i] = new bsv.Transaction.Output({
        script: bsv.Script('006a'),
        satoshis: 0
      })
    }
  })

  if (!cbdExists) {
    tx.addOutput(new bsv.Transaction.Output({
      script: bsv.Script('006a'),
      satoshis: 0
    }))
  }

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
