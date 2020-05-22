function addBlockInfo (extensionData) {
  // TODO: estimate coinbase size

  if (!extensionData || !extensionData.hasOwnProperty('miningCandidate')) {
    return
  }
  return {
    txCount: extensionData.miningCandidate.num_tx,
    blockSize: extensionData.miningCandidate.sizeWithoutCoinbase
  }
}

module.exports = addBlockInfo
