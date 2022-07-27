const config = require('config')
const rp = require('request-promise')

const { RPCClient } = require("@iangregsondev/rpc-bitcoin")

function _checkRequiredDataField (data, field) {
  if (!data.hasOwnProperty(field)) {
    throw new Error(`Missing "${field}" data field`)
  }
}

/**
 * Make a JSON-RPC connection to the Node.
 */
function rpcConnect () {
  const url = 'http://' + config.get('bitcoin.rpcHost')
  const user = config.get('bitcoin.rpcUser')
  const pass = config.get('bitcoin.rpcPassword')
  const port = config.get('bitcoin.rpcPort')
  const timeout = 10000
  // Initiate connection.
  const client = new RPCClient({ url, port, timeout, user, pass })
  if (client === undefined) {
     console.log('RPClient: connection error')
     return
  }
  return client
}

/**
 * Call getmineridinfo rpc to check if minerId keys are confirmed in Miner ID DB.
 */
async function checkMinerIdKeysConfirmed (minerId, prevMinerId) {
  try {
    console.debug(`${checkMinerIdKeysConfirmed.name}-parameters:
        minerId= ${minerId},
        prevMinerId= ${prevMinerId}`)
    const client = rpcConnect()
    const minerIdInfo = await client.getmineridinfo({hexdata: minerId})
    if (!minerIdInfo) {
      console.log('Empty result returned by getmineridinfo rpc.')
      return false
    }
    console.debug('Result: ', JSON.stringify(minerIdInfo))
    // Check mandatory data fields in the result set.
    _checkRequiredDataField(minerIdInfo, "minerId")
    _checkRequiredDataField(minerIdInfo, "minerIdState")
    _checkRequiredDataField(minerIdInfo, "prevMinerId")
    return (minerIdInfo["minerId"] == minerId) &&
           (minerIdInfo["minerIdState"] == "CURRENT") &&
           (minerIdInfo["prevMinerId"] == prevMinerId)
  } catch (e) {
    console.log('RPC error: ', e)
    return false
  }
}

/**
 * Call getmineridinfo rpc to check if revocationKey keys are confirmed in Miner ID DB.
 */
async function checkRevocationKeysConfirmed (minerId, revocationKey, prevRevocationKey) {
  try {
    console.debug(`${checkRevocationKeysConfirmed.name}-parameters:
        minerId= ${minerId},
        revocationKey= ${revocationKey},
        prevRevocationKey= ${prevRevocationKey}`)
    const client = rpcConnect()
    const minerIdInfo = await client.getmineridinfo({hexdata: minerId})
    if (!minerIdInfo) {
      console.log('Empty result returned by getmineridinfo rpc.')
      return false
    }
    console.debug('Result: ', JSON.stringify(minerIdInfo))
    // Check mandatory data fields in the result set.
    _checkRequiredDataField(minerIdInfo, "minerId")
    _checkRequiredDataField(minerIdInfo, "minerIdState")
    _checkRequiredDataField(minerIdInfo, "revocationKey")
    _checkRequiredDataField(minerIdInfo, "prevRevocationKey")
    return (minerIdInfo["minerId"] == minerId) &&
           (minerIdInfo["minerIdState"] == "CURRENT") &&
           (minerIdInfo["revocationKey"] == revocationKey) &&
           (minerIdInfo["prevRevocationKey"] == prevRevocationKey)
  } catch (e) {
    console.log('RPC error: ', e)
    return false
  }
}

module.exports = {
  rpcConnect,
  checkMinerIdKeysConfirmed,
  checkRevocationKeysConfirmed
}
