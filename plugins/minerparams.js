function addMinerParams ({ extensions = {}, jobData = {} }) {
  if (jobData.getInfo) {
    extensions.minerparams = {
      policy: {
        blockmaxsize: jobData.getInfo.maxblocksize,
        maxstackmemoryusagepolicy: jobData.getInfo.maxstackmemoryusagepolicy
      },
      consensus: {
        excessiveblocksize: jobData.getInfo.maxminedblocksize,
        maxstackmemoryusageconsensus: jobData.getInfo.maxstackmemoryusageconsensus
      }
    }
  }
}

module.exports = addMinerParams
