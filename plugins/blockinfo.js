function addBlockInfo ({ extensions = {}, extensionData = {} }) {
  if (extensionData.miningCandidate) {
    extensions.blockinfo = {
      txCount: extensionData.miningCandidate.num_tx,
      blockSize: extensionData.miningCandidate.sizeWithoutCoinbase // TODO: estimate coinbase size
    }
  }
}

module.exports = addBlockInfo
