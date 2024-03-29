// Distributed under the Open BSV software license, see the accompanying file LICENSE.

const bsv = require('bsv')
const request = require('request-promise')
const config = require('config')
const fm = require('../utils/filemanager')
const bitcoin = require('bitcoin-promise')
const cm = require('../utils/common')
const cb = require('../utils/callbacks')
const mi = require('../utils/minerinfo')
const cloneDeep = require('lodash.clonedeep')

// for mainnet: "livenet"
// for testnet: "testnet"
// for regtest: "testnet"
const network = config.get('network')
let networkName
switch (network) {
  case 'livenet':
    networkName = 'main'
    break

  case 'testnet':
  case 'regtest':
    networkName = 'test'
    break

  default:
    console.log('Network configuration not properly set in config.json file')
    break
}

const cbdVersion = '0.3'

/**
 * Generates a new miner ID reputation chain.
 *
 * The function generates minerId & revocation key private keys.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @returns (boolean) 'true' when miner ID data have been successfully created; otherwise 'false'.
 */
function generateMinerId (aliasName) {
  // the first alias has an underscore 1 appended so other aliases increment
  const alias = aliasName + '_1'
  try {
    // Check if aliasName is unused.
    const existsMinerId = fm.getMinerIdPublicKey(alias)
    if (existsMinerId) {
      console.error(`Miner ID alias "${aliasName}" already exists: minerId= ${existsMinerId}. Please choose another one.`)
      return false
    }
    const existsRevocationKey = fm.getRevocationKeyPublicKey(alias)
    if (existsRevocationKey) {
      console.error(`Miner ID alias "${aliasName}" is linked to the existing revocationKey= ${existsRevocationKey}. Please choose another one.`)
      return false
    }

    // Create minerId key.
    fm.createMinerId(alias)
    const minerId = fm.getMinerIdPublicKey(alias)
    console.log('Generated new minerId: ', minerId)
    // Create revocationKey key.
    fm.createRevocationKey(alias)
    const revocationKeyPublicKey = fm.getRevocationKeyPublicKey(alias)
    console.log('Generated new revocationKey: ', revocationKeyPublicKey)
    // Save the current MinerId alias.
    fm.saveMinerIdAlias(aliasName, alias)
    // Save the current Revocation Key alias.
    fm.saveRevocationKeyAlias(aliasName, alias)
    // Save the first minerId public key and initial opreturn status.
    let minerIdData = {}
    minerIdData["first_minerId"] = minerId
    minerIdData["opreturn_status"] = true
    fm.writeMinerIdDataToFile(aliasName, minerIdData)
    // Save revocation key data to the file.
    fm.writeRevocationKeyDataToFile(aliasName, false)
  } catch (err) {
    console.error('Please check that the signing_service is running properly...', err)
    return false
  }
  return true
}

function getCurrentMinerId (alias) {
  const currentMinerId = fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias(alias))
  return currentMinerId
}

function signWithCurrentMinerId (hash, alias) {
  const currentAlias = fm.getCurrentMinerIdAlias(alias)

  if (currentAlias === null) {
    return
  }
  return signHash(Buffer.from(hash, 'hex'), currentAlias)
}

function sign (payload, alias) {
  if (typeof payload === 'string') {
    payload = Buffer.from(payload, 'hex')
  }

  const hash = bsv.crypto.Hash.sha256(payload)

  return signHash(hash, alias)
}

function signHash (hash, alias) {
  const privateKey = fm.getMinerIdPrivateKey(alias)

  const signature = bsv.crypto.ECDSA.sign(hash, privateKey)
  return signature.toString('hex')
}

function _checkAliasExists(aliasName) {
  if (!aliasName || aliasName === '') {
    console.error('Must supply an alias')
    return false
  }
  if (!fm.aliasExists(aliasName)) {
    console.error(`Name "${aliasName}" doesn't exist.`)
    return false
  }
  return true
}

function _checkCurrentMinerIdPrivateKeyExists (aliasName) {
  // get current alias
  const currentAlias = fm.getCurrentMinerIdAlias(aliasName)
  if (!currentAlias) {
    console.error(`The minerId key alias "${aliasName}" doesn't exist.`)
    return false
  }
  // Check if the current minerId key is present in the key store.
  if (!fm.minerIdKeyExists(currentAlias)) {
    console.error(`The "${currentAlias}.key" minerId private key is not available in the key store.`)
    return false
  }
  return true
}

/**
 * Rotates the current minerId key.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @returns (boolean) 'true' when the key has been successfully rotated; otherwise 'false'.
 */
function rotateMinerId (aliasName) {
  if (!_checkAliasExists(aliasName)) {
    return false
  }
  try {
    if (!_checkCurrentMinerIdPrivateKeyExists(aliasName)) {
      return false
    }
    // get current alias
    const currentAlias = fm.getCurrentMinerIdAlias(aliasName)
    // increment alias prefix
    const newAlias = fm.incrementAliasPrefix(currentAlias)
    // save alias
    fm.saveMinerIdAlias(aliasName, newAlias)
    // get minerId
    fm.createMinerId(newAlias)
    // update keys info in minerIdData file
    fm.updateKeysInfoInMinerIdDataFile(aliasName)
    // Rotation invalidates the last generated miner-info op_return script.
    fm.writeOpReturnStatusToFile(aliasName, false)
  } catch (err) {
    console.error('minerId rotation: ', err)
    return false
  }
  return true
}

// Check if the revocationKey is available.
function _checkCurrentRevocationPrivateKeyExists (aliasName) {
  // get current alias
  const currentAlias = fm.getCurrentRevocationKeyAlias(aliasName)
  if (!currentAlias) {
    console.error(`The revocation key alias "${aliasName}" doesn't exist.`)
    return false
  }
  // Check if the current revocation key is present in the revocation key store.
  if (!fm.revocationKeyExists(currentAlias)) {
    console.error(`The "${currentAlias}.key" revocation private key is not available in the key store.`)
    return false
  }
  return true
}

/**
 * Rotates the current revocation key.
 *
 * The function requires an access to the revocationKey private key.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @returns (boolean) 'true' when the key has been successfully rotated; otherwise 'false'.
 */
function rotateRevocationKey (aliasName) {
  if (!_checkAliasExists(aliasName)) {
    return false
  }
  try {
    // Check if the key to be rotated is available.
    if (!_checkCurrentRevocationPrivateKeyExists(aliasName)) {
      return false
    }
    // get current alias
    const currentAlias = fm.getCurrentRevocationKeyAlias(aliasName)
    // increment alias prefix
    const newAlias = fm.incrementAliasPrefix(currentAlias)
    // save alias
    fm.saveRevocationKeyAlias(aliasName, newAlias)
    // create a new revocation key
    fm.createRevocationKey(newAlias)
    // Save revocation key data to the file.
    fm.writeRevocationKeyDataToFile(aliasName, true)
    // Rotation invalidates the last generated miner-info op_return script.
    fm.writeOpReturnStatusToFile(aliasName, false)
  } catch (err) {
    console.error('revocationKey rotation: ', err)
    return false
  }
  return true
}

/**
 * Revokes the specified minerId public key.
 *
 * The function requires an access to minerId & revocationKey private keys.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @param minerIdPubKey (a hex-string) minerId public key to be revoked.
 * @param isCompleteRevocation (boolean) Flag indicating a partial or complete revocation.
 * @returns (boolean) 'true' when revocation data have been successfully created; otherwise 'false'.
 */
async function revokeMinerId (aliasName, minerIdPubKey, isCompleteRevocation) {
  // Call the node to invalidate the specified key and to broadcast a P2P revokemid message to the network.
  async function _revokeMinerIdNotification(aliasName, minerIdPubKey) {
    // Revocation key data.
    const revocationKeyPrivateKey = fm.getRevocationKeyPrivateKey(fm.getCurrentRevocationKeyAlias(aliasName))
    const revocationKeyPublicKey = fm.getRevocationKeyPublicKey(fm.getCurrentRevocationKeyAlias(aliasName))
    // MinerId key data.
    const minerIdPrivateKey = fm.getMinerIdPrivateKey(fm.getCurrentMinerIdAlias(aliasName))
    const minerIdPublicKey = fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias(aliasName))
    // Revocation message data.
    const hash = bsv.crypto.Hash.sha256(Buffer.from(minerIdPubKey, 'hex'))
    // Prepare an input parameter to be used by the callback.
    const input = {
       "revocationKey": revocationKeyPublicKey.toString('hex'),
       "minerId": minerIdPublicKey.toString('hex'),
       "revocationMessage": {
           "compromised_minerId": minerIdPubKey.toString('hex')
       },
       "revocationMessageSig": {
           "sig1": bsv.crypto.ECDSA.sign(hash, revocationKeyPrivateKey).toString('hex'),
           "sig2": bsv.crypto.ECDSA.sign(hash, minerIdPrivateKey).toString('hex')
       }
    }
    await cb.revokeMinerId(input)
  }
  if (!_checkAliasExists(aliasName)) {
    return false
  }
  try {
    // Check if the key needed to create revocationMessageSig:sig1 exists.
    if (!_checkCurrentRevocationPrivateKeyExists(aliasName)) {
      return false
    }
    // Check if the key needed to create revocationMessageSig:sig2 exists.
    if (!_checkCurrentMinerIdPrivateKeyExists(aliasName)) {
      return false
    }
    // Check conditions specific to the partial revocation.
    if (!isCompleteRevocation) {
      const minerIdData = fm.readMinerIdDataFromFile(aliasName)
      if (!minerIdData.hasOwnProperty('first_minerId')) {
        throw new Error('Cannot find "first_minerId" in the config file.')
      }
      if (minerIdData["first_minerId"] == minerIdPubKey) {
        throw new Error('An attempt to terminate the entire Miner ID reputation chain.')
      }
    }
    // Call the configured callback to revoke the specified minerId and to send
    // a fast notification to the network.
    await _revokeMinerIdNotification(aliasName, minerIdPubKey)
    // At this stage a partial revocation procedure requires to rotate the current minerId key.
    if (!isCompleteRevocation) {
      if (rotateMinerId(aliasName)) {
        console.log('The compromised minerId has been rotated successfully.')
      } else {
        throw new Error("The compromised minerId key rotation has failed!")
      }
    }
    // Creates protocol data to be dynamically used during miner-info document's construction.
    fm.createMinerIdRevocationData (aliasName, minerIdPubKey, isCompleteRevocation)
    // Revocation invalidates the last generated miner-info op_return script.
    fm.writeOpReturnStatusToFile(aliasName, false)
  } catch (err) {
    console.error('minerId revocation: ', err)
    return false
  }
  return true
}

/**
 * Checks if the current miner ID protocol can be upgraded to the newest version.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @returns (boolean) 'true' if an upgrade is possible; otherwise 'false'.
 */
function canUpgradeMinerIdProtocol (aliasName) {
  if (!fm.copyAliasesFile(aliasName)) {
    return false
  }
  if (!_checkAliasExists(aliasName)) {
    return false
  }
  try {
    // Check if the key needed to create revocationMessageSig:sig2 exists.
    if (!_checkCurrentMinerIdPrivateKeyExists(aliasName)) {
      return false
    }
    // get current revocation key alias
    const currentAlias = fm.getCurrentRevocationKeyAlias(aliasName)
    if (currentAlias) {
      throw new Error(`minerId is already upgraded. The revocation key alias "${currentAlias}" does exist.`)
    }
    // Check if the initial revocationKey private key is present in the revocation key store.
    if (fm.revocationKeyExists(aliasName+'_1')) {
      throw new Error(`minerId is already upgraded. The "${aliasName}_1.key" revocation private key is available in the key store.`)
    }
  } catch (err) {
    console.error('Upgrading miner ID protocol data: ', err)
    return false
  }
  return true
}

/**
 * Creates a miner-info document.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @param height (number) Block height in which Miner ID document is included.
 * @param dataRefsTxId (hex string) DataRefs txid to be linked with Miner ID document.
 * @returns (a hex-string) Miner-info document.
 */
async function createMinerInfoDocument (aliasName, height, dataRefsTxId) {
  async function _checkIfMinerIdRevocationOccurred(doc) {
    const minerIdRevocationData = fm.readMinerIdRevocationDataFromFile(aliasName)
    if (minerIdRevocationData) {
      if (minerIdRevocationData["complete_revocation"]) {
        await cb.isMinerIdRevocationConfirmed(
          doc.minerId,
          minerIdRevocationData["prevMinerId"],
          minerIdRevocationData.revocationMessage["compromised_minerId"],
          "REVOKED",
          "Complete")
        // Check if the prevMinerId field is normalised
        if (doc.prevMinerId !== doc.minerId) {
          doc.prevMinerId = minerIdRevocationData["prevMinerId"]
          doc.prevMinerIdSig = minerIdRevocationData["prevMinerIdSig"]
        }
      } else {
        if (await cb.isMinerIdRevocationConfirmed(
          doc.minerId,
          minerIdRevocationData["prevMinerId"],
          minerIdRevocationData.revocationMessage["compromised_minerId"],
          "CURRENT",
          "Partial")) {
          fm.deleteMinerIdRevocationDataFile(aliasName)
          return
	}
      }
      doc.revocationMessage = {}
      doc.revocationMessage = minerIdRevocationData.revocationMessage
      doc.revocationMessageSig = {}
      doc.revocationMessageSig = minerIdRevocationData.revocationMessageSig
    }
  }
  const minerIdData = await fm.readMinerIdDataAndUpdateMinerIdKeysStatus(aliasName)
  const revocationKeyData = await fm.readRevocationKeyDataAndUpdateKeysStatus(aliasName)

  let doc = {
    version: cbdVersion,
    height: height,

    prevMinerId: minerIdData["prevMinerId"],
    prevMinerIdSig: minerIdData["prevMinerIdSig"],

    minerId: minerIdData["minerId"],

    prevRevocationKey: revocationKeyData["prevRevocationKey"],
    revocationKey: revocationKeyData["revocationKey"],
    prevRevocationKeySig: revocationKeyData["prevRevocationKeySig"]
  }

  await _checkIfMinerIdRevocationOccurred(doc)

  const optionalData = fm.readOptionalMinerIdData(aliasName)
  if (optionalData) {
    doc = { ...doc, ...optionalData }
  }

  if (dataRefsTxId !== undefined) {
    fm.createDataRefsFile(aliasName, dataRefsTxId)
  }
  const dataRefs = fm.readDataRefsFromFile(aliasName)
  if (dataRefs) {
    doc.extensions = { ...doc.extensions, ...dataRefs }
  }

  return doc
}

/**
 * Support for 'GET /opreturn/:alias/:blockHeight([0-9]+)' and
 * 'GET /opreturn/:alias/:blockHeight([0-9]+)/:dataRefsTxId' requests.
 *
 * The function creates op_return script containing a miner-info document and its signature.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @param height (number) Block height in which Miner ID document is included.
 * @param dataRefsTxId (a hex-string) DataRefs txid to be linked with Miner ID document.
 * @returns (a hex-string) Miner-info op_return script.
 */
async function createMinerInfoOpReturn (aliasName, height, dataRefsTxId) {
  if (!aliasName || aliasName === '') {
    console.error('Must supply an alias')
    return
  }
  if (!fm.aliasExists(aliasName)) {
    console.error(`Name "${aliasName}" doesn't exist.`)
    return
  }
  if (height < 1) {
    console.error('Must enter a valid height')
    return
  }

  const doc = await createMinerInfoDocument(aliasName, parseInt(height), dataRefsTxId)
  console.debug('Miner-info doc:\n' + JSON.stringify(doc))

  const payload = JSON.stringify(doc)
  const signature = sign(Buffer.from(payload), fm.getCurrentMinerIdAlias(aliasName))
  console.debug('Miner-info-doc sig:\n' + signature.toString('hex'))

  const opReturnScript = mi.createMinerInfoOpReturnScript(payload, signature).toHex()
  // Generated op_return script is valid.
  fm.writeOpReturnStatusToFile(aliasName, true)

  return opReturnScript
}

/**
 * Support for 'GET /datarefs/:alias/opreturns' requests.
 *
 * The function reads a dataRefs tx configuration and creates op_return script for each defined outpoint.
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @returns (an array of hex-strings) DataRefs op_return script(s).
 */
function createDataRefsOpReturns(aliasName) {
  let dataRefsOpReturnScripts = []
  const txData = fm.readDataRefsTxFile(aliasName)
  if (txData) {
    txData.dataRefs.refs.forEach(
       function(obj) {
         dataRefsOpReturnScripts.push(mi.createDataRefOpReturnScript(JSON.stringify(obj.data)).toHex())
    })
  }
  return dataRefsOpReturnScripts
}

/**
 * Support for async POST /coinbase2 requests.
 *
 * The function creates coinbase2 with the following data:
 * (1) minerInfoTxId
 * (2) blockBind
 * (3) blockBindSig
 *
 * @param aliasName (string) An existing Miner ID alias to use.
 * @param minerInfoTxId (a hex-string) An existing miner-info transaction id.
 * @param prevhash (a hex-string) Hash of the previous block.
 * @param merkleProof (list of hex strings) Merkle branches from the mining candidate.
 * @param coinbase2 (a hex-string) The 2nd part of the coinbase tx.
 * @returns (a hex-string) coinbase2 extended by (1)-(3) data.
 */
async function createCoinbase2 (aliasName, minerInfoTxId, prevhash, merkleProof, coinbase2) {
  console.debug('minerInfoTxId: ' + minerInfoTxId)

  /**
   * Create a modified coinbase tx from cb1 & cb2 parts.
   */
  const ctx = mi.makeCoinbaseTx(mi.placeholderCB1, coinbase2)
  // Make a deep copy of the ctx. It is needed to create the final version of cb2 part.
  const ctx2 = cloneDeep(ctx)

  /**
   * Create a modified miner-info coinbase tx.
   */
  const modifiedMinerInfoCoinbaseTx = mi.createMinerInfoCoinbaseTx(ctx, minerInfoTxId)
  console.debug('modifiedMinerInfoCoinbaseTx.id: ', modifiedMinerInfoCoinbaseTx.id)
  /**
   * Calculate merkleRoot using miner-info cb2 and merkle branches from the mining candidate.
   */
  const modifiedMerkleRoot = mi.buildMerkleRootFromCoinbase(modifiedMinerInfoCoinbaseTx.id, merkleProof)
  console.debug('modifiedMerkleRoot: ', modifiedMerkleRoot)
  console.debug('prevhash: ', prevhash)

  /**
   * Calculate block binding data.
   */
  const blockBindPayload = Buffer.concat([
    Buffer.from(modifiedMerkleRoot, 'hex').reverse(), // swap endianness before concatenating
    Buffer.from(prevhash, 'hex').reverse() // swap endianness before concatenating
  ])
  // blockBind
  const blockBind = bsv.crypto.Hash.sha256(blockBindPayload)
  console.debug('blockBind: ', blockBind.toString('hex'))
  // blockBindSig
  const blockBindSig = signHash(blockBind, fm.getCurrentMinerIdAlias(aliasName))
  console.debug('blockBindSig: ', blockBindSig)

  /**
   * Make a miner-info coinbase tx with the block binding support.
   */
  const minerInfoCbTxWithBlockBind =
    mi.createMinerInfoCoinbaseTxWithBlockBind(ctx2, minerInfoTxId, blockBind, blockBindSig)
  // Now we only want to return coinbase2 so remove first part of the coinbase (cb1)
  return minerInfoCbTxWithBlockBind.toString().substring(mi.placeholderCB1.length)
}

/**
 * Support for /opreturn/:alias/isvalid requests.
 *
 * Informs the caller about the status of the last generated miner-info op_return script,
 * returns:
 * (a) 'true'  - the in-use script is valid for the requested alias,
 * (b) 'false' - the in-use script is invalid due to a key rotation or revocation
 *     executed by an operator using CLI command interface for the given alias.
 *
 * The next miner-info document creation sets the status to 'true'.
 *
 * @returns (boolean) a miner-info op_return script status.
 */
function opReturnStatus(aliasName) {
  return fm.readOpReturnStatusFromFile(aliasName)
}

module.exports = {
  createNewCoinbase2: createCoinbase2,
  createMinerInfoOpReturn,
  createDataRefsOpReturns,
  generateMinerId,
  rotateMinerId,
  rotateRevocationKey,
  revokeMinerId,
  canUpgradeMinerIdProtocol,
  getCurrentMinerId,
  signWithCurrentMinerId,
  opReturnStatus
}
