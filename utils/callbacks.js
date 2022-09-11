const config = require('config')

const { RPCClient } = require("@iangregsondev/rpc-bitcoin")

function _checkRequiredDataField (data, field) {
  if (!data.hasOwnProperty(field)) {
    throw new Error(`Missing "${field}" data field`)
  }
}

/**
 * Makes a JSON-RPC connection to the Node.
 *
 * @returns (an object) A valid connection to the node or null.
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
     console.error('RPClient: connection error')
     return
  }
  return client
}

/**
 * Calls getmineridinfo RPC to check if minerId public keys are confirmed in the Miner ID DB.
 *
 * @param minerId (a hex-string) minerId public key to be checked.
 * @param prevMinerId (a hex-string) prevMinerId public key to be checked.
 * @param minerIdState (string) An expected state of the minerId public key.
 * @returns (boolean)
 *  'true' indicates that the minerId public keys are confirmed;
 *  'false' there is no match in the DB or an error has occurred during the request.
 */
async function checkMinerIdKeysConfirmed (minerId, prevMinerId, minerIdState) {
  try {
    console.debug(`${checkMinerIdKeysConfirmed.name}-parameters:
        minerId= ${minerId},
        prevMinerId= ${prevMinerId},
	minerIdState= ${minerIdState}`)
    const client = rpcConnect()
    const minerIdInfo = await client.getmineridinfo({hexdata: minerId})
    if (!minerIdInfo || JSON.stringify(minerIdInfo) === '{}') {
      console.error('Empty result returned by getmineridinfo rpc.')
      return false
    }
    console.debug('Result: ', JSON.stringify(minerIdInfo))
    // Check mandatory data fields in the result set.
    _checkRequiredDataField(minerIdInfo, "minerId")
    _checkRequiredDataField(minerIdInfo, "minerIdState")
    _checkRequiredDataField(minerIdInfo, "prevMinerId")
    return (minerIdInfo["minerId"] == minerId) &&
           (minerIdInfo["minerIdState"] == minerIdState) &&
           (minerIdInfo["prevMinerId"] == prevMinerId)
  } catch (e) {
    console.error('RPC error: ', e)
    return false
  }
}

/**
 * Calls getmineridinfo RPC to check if revocationKey public keys are confirmed in the Miner ID DB.
 *
 * Note: The minerIdStatus must be set as 'CURRENT' in the DB.
 *
 * @param minerId (a hex-string) minerId public key to be checked.
 * @param revocationKey (a hex-string) revocationKey public key to be checked.
 * @param prevRevocationKey (a hex-string) prevRevocationKey public key to be checked.
 * @returns (boolean)
 *  'true' indicates that the revocation public keys are confirmed;
 *  'false' there is no match in the DB or an error has occurred during the request.
 */
async function checkRevocationKeysConfirmed (minerId, revocationKey, prevRevocationKey) {
  try {
    console.debug(`${checkRevocationKeysConfirmed.name}-parameters:
        minerId= ${minerId},
        revocationKey= ${revocationKey},
        prevRevocationKey= ${prevRevocationKey}`)
    const client = rpcConnect()
    const minerIdInfo = await client.getmineridinfo({hexdata: minerId})
    if (!minerIdInfo || JSON.stringify(minerIdInfo) === '{}') {
      console.error('Empty result returned by getmineridinfo rpc.')
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
    console.error('RPC error: ', e)
    return false
  }
}

/**
 * Checks if minerId revocation is confirmed in the Miner ID DB
 * based on checkMinerIdKeysConfirmed call.
 *
 * @param minerId (a hex-string) minerId public key to be checked.
 * @param prevMinerId (a hex-string) prevMinerId public key to be checked.
 * @param compromisedMinerid (a hex-string) compromisedMinerid public key only used to add a log message.
 * @param minerIdState (string) An expected state of the minerId public key.
 * @param revocationName (string) Revocation type only used to add a log message.
 * @returns (boolean)
 *  'true' indicates that the minerId revocation has been confirmed;
 *  'false' there is no match in the DB or an error has occurred during the request.
 */
async function isMinerIdRevocationConfirmed(minerId, prevMinerId, compromisedMinerid, minerIdState, revocationName) {
  console.debug(`${isMinerIdRevocationConfirmed.name}-parameters:
      minerId= ${minerId},
      prevMinerId= ${prevMinerId},
      compromisedMinerid= ${compromisedMinerid},
      minerIdState= ${minerIdState},
      revocationName= ${revocationName}`)
  if (await checkMinerIdKeysConfirmed(minerId, prevMinerId, minerIdState)) {
    console.debug(`${revocationName} revocation is confirmed for minerId= ${compromisedMinerid}`)
    return true
  }
  console.debug(`${revocationName} revocation is not confirmed for minerId= ${compromisedMinerid}`)
  return false
}

/**
 * Uses revokeminerid RPC to revoke the given compromised minerId public key.
 *
 * The connected node will update its own Miner ID DB. After that,
 * it will send the revokemid P2P network message to the network.
 *
 * The input parameter is defined as a json object of the following form:
 *  {
 *      "revocationKey": xxxx,
 *      "minerId": xxxx,
 *      "revocationMessage": {
 *          "compromised_minerId": xxxx
 *      },
 *      "revocationMessageSig": {
 *          "sig1": xxxx,
 *          "sig2": xxxx
 *      }
 *  }
 *
 * @param input (a json-object) The input argument defined as above.
 * @returns (boolean)
 *  'true' indicates that the minerId public key has been revoked;
 *  'false' the minerId public key has not been revoked or an error has occurred during the request.
 */
async function revokeMinerId (input) {
  try {
    console.debug(`${revokeMinerId.name}-parameters: ${JSON.stringify(input)}`)
    const client = rpcConnect()
    await client.revokeminerid({input})
  } catch (e) {
    console.error('RPC error: ', e)
    return false
  }
}

module.exports = {
  rpcConnect,
  checkMinerIdKeysConfirmed,
  checkRevocationKeysConfirmed,
  isMinerIdRevocationConfirmed,
  revokeMinerId
}
