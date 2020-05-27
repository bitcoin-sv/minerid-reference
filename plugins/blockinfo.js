function addBlockInfo ({ extensions = {}, jobData = {} }) {
  const { miningCandidate } = jobData

  if (!miningCandidate) {
    return
  }

  if (!miningCandidate.num_tx) {
    return
  }

  if (!miningCandidate.sizeWithoutCoinbase) {
    return
  }

  extensions.blockinfo = {
    txCount: miningCandidate.num_tx,
    blockSize: miningCandidate.sizeWithoutCoinbase // TODO: estimate coinbase size
  }
}

module.exports = addBlockInfo
