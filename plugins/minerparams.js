function addMinerParams ({ extensions = {}, extensionData = {} }) {
  if (extensionData.getInfo) {
    extensions.minerparams = {
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
}

module.exports = addMinerParams
