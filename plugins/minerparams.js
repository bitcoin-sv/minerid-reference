function addMinerParams ({ extensions = {}, jobData = {} }) {
  const { getInfo } = jobData

  if (!getInfo) {
    return
  }

  const { maxblocksize, maxstackmemoryusagepolicy, maxminedblocksize, maxstackmemoryusageconsensus } = getInfo

  if (!maxblocksize) {
    return
  }

  if (!maxstackmemoryusagepolicy) {
    return
  }

  if (!maxminedblocksize) {
    return
  }

  if (!maxstackmemoryusageconsensus) {
    return
  }

  extensions.minerparams = {
    policy: {
      blockmaxsize: maxblocksize,
      maxstackmemoryusagepolicy: maxstackmemoryusagepolicy
    },
    consensus: {
      excessiveblocksize: maxminedblocksize,
      maxstackmemoryusageconsensus: maxstackmemoryusageconsensus
    }
  }
}

module.exports = addMinerParams
