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
    sizeWithoutCoinbase: miningCandidate.sizeWithoutCoinbase
  }
}

module.exports = addBlockInfo
