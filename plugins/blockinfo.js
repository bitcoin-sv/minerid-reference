function addBlockInfo ({ extensions = {}, jobData = {} }) {
  if (jobData.miningCandidate) {
    extensions.blockinfo = {
      txCount: jobData.miningCandidate.num_tx,
      blockSize: jobData.miningCandidate.sizeWithoutCoinbase // TODO: estimate coinbase size
    }
  }
}

module.exports = addBlockInfo
