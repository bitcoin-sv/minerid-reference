function addMinerParams (extensionData) {
  if (!extensionData || !extensionData.hasOwnProperty('getInfo')) {
    return
  }

  return {
    policy: {
      blockmaxsize: extensionData.getInfo.maxblocksize,
      maxstackmemoryusagepolicy: extensionData.getInfo.maxstackmemoryusagepolicy
    },
    consensus: {
      excessiveblocksize: extensionData.getInfo.maxminedblocksize,
      maxstackmemoryusageconsensus: extensionData.getInfo.maxstackmemoryusageconsensus
    }
  }
}

module.exports = addMinerParams
