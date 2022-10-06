const fs = require('fs')
const path = require('path')
const bsv = require('bsv')

const cm = require('./common')
const cb = require('./callbacks')

const config = require('config')
var filedir = config.get('minerIdDataPath')
const minerIdKeystorePath = config.get('keystorePath')
const revocationKeystorePath = config.get('revocationKeystorePath')

const MINERID_OPTIONAL_DATA_FILENAME = 'minerIdOptionalData'

const MINERID_ALIASES_FILENAME = 'minerIdAliases'
const REVOCATIONKEY_ALIASES_FILENAME = 'revocationKeyAliases'

const REVOCATION_KEY_DATA_FILENAME = 'revocationKeyData'

const MINERID_REVOCATION_DATA_FILENAME = 'minerIdRevocationData'

const MINERID_DATA_FILENAME = 'minerIdData'

const DATAREFS_DATA_FILENAME = 'dataRefs'
const DATAREFS_TX_DATA_FILENAME = 'dataRefsTxData'

// Checks if a folder (with the given name) exists.
function aliasExists (aliasName) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName)

  if (fs.existsSync(filePath)) {
    return true
  }
  return false
}

/**
 * Common non-exported functions.
 */
function _createKey (alias, keyPath) {
  const xpriv = bsv.HDPrivateKey()

  const dir = path.join(process.env.HOME, keyPath)
  makeDirIfNotExists(dir)

  const filePath = path.join(dir, alias + '.key')
  fs.writeFileSync(filePath, xpriv.toString())
}

function _getPrivateKey (alias, keyPath) {
  const dir = path.join(process.env.HOME, keyPath)
  makeDirIfNotExists(dir)

  const filePath = path.join(dir, alias + '.key')

  try {
    const data = fs.readFileSync(filePath)

    const xpriv = bsv.HDPrivateKey(data.toString().trim())

    return xpriv.privateKey
  } catch (err) {
    return null
  }
}

function _getPublicKey (privateKey) {
  if (privateKey) {
    return privateKey.publicKey.toString()
  }
  return null
}

function _readDataFromJsonFile (aliasName, fileName) {
  if (!aliasExists(aliasName)) {
    console.error(`Name "${aliasName}" doesn't exist.`)
    return
  }
  const filePath = path.join(process.env.HOME, filedir, aliasName, fileName)
  if (!fs.existsSync(filePath)) {
    console.debug(`File "${filePath}" doesn't exist.`)
    return
  }
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (err) {
    console.error(`Reading data from the file ${filePath}`, err)
    return
  }
  return data
}

function _writeJsonDataToFile (aliasName, data, fileName) {
  const filePath = path.join(process.env.HOME, filedir, aliasName, fileName)
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
    throw new Error(`Writing json data to the file ${filePath}`)
  }
}

/**
 * Basic MinerId key exported functions.
 */
function createMinerId (alias) {
  _createKey(alias, minerIdKeystorePath)
}

function getMinerIdPrivateKey (alias) {
  return _getPrivateKey(alias, minerIdKeystorePath)
}

function getMinerIdPublicKey (alias) {
  return _getPublicKey(getMinerIdPrivateKey(alias))
}

/**
 * Basic revocation key exported functions.
 */
function createRevocationKey (alias) {
  _createKey(alias, revocationKeystorePath)
}

function getRevocationKeyPrivateKey (alias) {
  return _getPrivateKey(alias, revocationKeystorePath)
}

function getRevocationKeyPublicKey (alias) {
  return _getPublicKey(getRevocationKeyPrivateKey(alias))
}

/**
 * Other utility functions.
 */
function _checkIfKeyExists (alias, keyPath) {
  const dir = path.join(process.env.HOME, keyPath)
  const filePath = path.join(dir, alias + '.key')
  try {
    return fs.existsSync(filePath)
  } catch (e) {
    return false
  }
}

function minerIdKeyExists(alias) {
  return _checkIfKeyExists(alias, minerIdKeystorePath)
}

function revocationKeyExists(alias) {
  return _checkIfKeyExists(alias, revocationKeystorePath)
}

/**
 * The function writes a revocation key related data into the REVOCATION_KEY_DATA_FILENAME file.
 *
 * The following data fields are stored in a json format:
 * (a) 'prevRevocationKey' public key.
 * (b) 'revocationKey' public key.
 * (c) 'prevRevocationKeySig' signature.
 * In the case of a revocation key rotation the private key is used to create (a)-(c) data
 * for the next document what is necessary to normalise 'prevRevocationKey' data field.
 *
 * Note:
 * The revocation private key should be kept offline. The key must be available only to:
 * (a) rotate the current revocation key, or
 * (b) sign a revocation message
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @param isKeyRotation (boolean) Flag indicates if a revocation key rotation occurs.
 */
function writeRevocationKeyDataToFile (aliasName, isKeyRotation) {
  let revocationKeyData = {}
  // prevRevocationKey
  const prevRevocationKeyPublicKey = getRevocationKeyPublicKey(getPreviousRevocationKeyAlias(aliasName))
  revocationKeyData["prevRevocationKey"] = prevRevocationKeyPublicKey
  // revocationKey
  const revocationKeyPublicKey = getRevocationKeyPublicKey(getCurrentRevocationKeyAlias(aliasName))
  revocationKeyData["revocationKey"] = revocationKeyPublicKey
  // prevRevocationKeySig
  {
    const hash = bsv.crypto.Hash.sha256(cm.concatFields(prevRevocationKeyPublicKey, revocationKeyPublicKey))
    const privateKey = getRevocationKeyPrivateKey(getPreviousRevocationKeyAlias(aliasName))
    const prevRevocationKeySig = bsv.crypto.ECDSA.sign(hash, privateKey)
    revocationKeyData["prevRevocationKeySig"] = prevRevocationKeySig.toString('hex')
  }
  if (isKeyRotation) {
    revocationKeyData.nextDocData = {}
    revocationKeyData.nextDocData["prevRevocationKey"] = revocationKeyData["revocationKey"]
    revocationKeyData.nextDocData["revocationKey"] = revocationKeyData["revocationKey"]
    // prevRevocationKeySig
    const hash = bsv.crypto.Hash.sha256(cm.concatFields(revocationKeyData.nextDocData["prevRevocationKey"], revocationKeyData.nextDocData["revocationKey"]))
    const privateKey = getRevocationKeyPrivateKey(getCurrentRevocationKeyAlias(aliasName))
    const prevRevocationKeySig = bsv.crypto.ECDSA.sign(hash, privateKey)
    revocationKeyData.nextDocData["prevRevocationKeySig"] = prevRevocationKeySig.toString('hex')
  }
  // Write revocationKeyData to the file.
  _writeJsonDataToFile(aliasName, revocationKeyData, REVOCATION_KEY_DATA_FILENAME)
}

function updateRevocationKeyData (aliasName, revocationKeyData) {
  _writeJsonDataToFile(aliasName, revocationKeyData, REVOCATION_KEY_DATA_FILENAME)
}

function _checkRequiredDataField (data, field, fileName) {
  if (!data.hasOwnProperty(field)) {
    throw new Error(`Missing "${field}" data field in the "${fileName}" config file.`)
  }
}

/**
 * The function reads a revocation key related data from the REVOCATION_KEY_DATA_FILENAME file.
 *
 * The required data fields are:
 * (a) 'prevRevocationKey' public key.
 * (b) 'revocationKey' public key.
 * (c) 'prevRevocationKeySig' signature.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @returns (an object) Revocation key data fields.
 */
function readRevocationKeyDataFromFile (aliasName) {
  const revocationKeyData = _readDataFromJsonFile(aliasName, REVOCATION_KEY_DATA_FILENAME)
  if (!revocationKeyData) {
    throw new Error(`Missing "${REVOCATION_KEY_DATA_FILENAME}" config file.`)
  }
  _checkRequiredDataField(revocationKeyData, "prevRevocationKey", REVOCATION_KEY_DATA_FILENAME)
  _checkRequiredDataField(revocationKeyData, "revocationKey", REVOCATION_KEY_DATA_FILENAME)
  _checkRequiredDataField(revocationKeyData, "prevRevocationKeySig", REVOCATION_KEY_DATA_FILENAME)
  return revocationKeyData
}

/**
 * This function is an extension to the readRevocationKeyDataFromFile function.
 *
 * Operations executed:
 * 1. Reads a revocation key related data.
 * 2. Checks if 'prevRevocationKey' data field needs to be normalised.
 * 2.1 Normalises the data field if it is required.
 * 3. Returns correct revocation key data.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @returns (an object) Revocation key data.
 */
async function readRevocationKeyDataAndUpdateKeysStatus (aliasName) {
  function _normalisePrevRevocationKey (aliasName, revocationKeyData) {
    let revocationKeyData2 = {}
    // Check if the 'nextDocData' section is available.
    _checkRequiredDataField(revocationKeyData, "nextDocData", REVOCATION_KEY_DATA_FILENAME)
    _checkRequiredDataField(revocationKeyData.nextDocData, "prevRevocationKey", REVOCATION_KEY_DATA_FILENAME)
    revocationKeyData2["prevRevocationKey"] = revocationKeyData.nextDocData["prevRevocationKey"]
    _checkRequiredDataField(revocationKeyData.nextDocData, "revocationKey", REVOCATION_KEY_DATA_FILENAME)
    revocationKeyData2["revocationKey"] = revocationKeyData.nextDocData["revocationKey"]
    _checkRequiredDataField(revocationKeyData.nextDocData, "prevRevocationKeySig", REVOCATION_KEY_DATA_FILENAME)
    revocationKeyData2["prevRevocationKeySig"] = revocationKeyData.nextDocData["prevRevocationKeySig"]
    _writeJsonDataToFile(aliasName, revocationKeyData2, REVOCATION_KEY_DATA_FILENAME)
    return revocationKeyData2
  }
  let revocationKeyData = {}
  revocationKeyData = readRevocationKeyDataFromFile (aliasName)
  if (revocationKeyData["prevRevocationKey"] != revocationKeyData["revocationKey"]) {
    // Check if a revocationKey rotation is confirmed on the blockchain.
    if (await cb.checkRevocationKeysConfirmed(
        getMinerIdPublicKey(getCurrentMinerIdAlias(aliasName)),
        revocationKeyData["revocationKey"],
        revocationKeyData["prevRevocationKey"])) {
      return _normalisePrevRevocationKey(aliasName, revocationKeyData)
    }
  }
  return revocationKeyData
}

/**
 * The function creates data required by the miner ID revocation procedure.
 *
 * The data are written into the MINERID_REVOCATION_DATA_FILENAME file.
 *
 * Note: At this stage the revocation key private key must be accessible.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @param compromisedMinerIdPubKey (a hex-string) The compromised minerId public key.
 * @param isCompleteRevocation (boolean) 'true' indicates a complete revocation; 'false' a partial revocation.
 */
function createMinerIdRevocationData (aliasName, compromisedMinerIdPubKey, isCompleteRevocation) {
  console.log('Compromised minerId to be revoked: ', compromisedMinerIdPubKey)
  // minerId revocation data to be written into the file.
  let revocationData = {}
  revocationData["complete_revocation"] = isCompleteRevocation
  revocationData.revocationMessage = {}
  revocationData.revocationMessage["compromised_minerId"] = compromisedMinerIdPubKey
  const revocationMessagePayload = Buffer.from(compromisedMinerIdPubKey, 'hex')
  const revocationMessageHash = bsv.crypto.Hash.sha256(revocationMessagePayload)
  // Create revocationMessageSig1.
  const revocationKeyPrivateKey = getRevocationKeyPrivateKey(getCurrentRevocationKeyAlias(aliasName))
  const revocationMessageSig1 = bsv.crypto.ECDSA.sign(revocationMessageHash, revocationKeyPrivateKey)
  revocationData.revocationMessageSig = {}
  revocationData.revocationMessageSig["sig1"] = revocationMessageSig1.toString('hex')
  let revocationMessageSig2 = {}
  if (isCompleteRevocation) {
    // Create revocationMessageSig2.
    const minerIdPrivateKey = getMinerIdPrivateKey(getCurrentMinerIdAlias(aliasName))
    revocationMessageSig2 = bsv.crypto.ECDSA.sign(revocationMessageHash, minerIdPrivateKey)
    // Complete revocation sets 'prevMinerId' to 'minerId' (both fields hold the same public key).
    const minerId = getMinerIdPublicKey(getCurrentMinerIdAlias(aliasName))
    revocationData["prevMinerId"] = minerId.toString('hex')
    // prevMinerIdSig
    const hash = bsv.crypto.Hash.sha256(cm.concatFields(minerId, minerId))
    const prevMinerIdPrivateKey = getMinerIdPrivateKey(getPreviousMinerIdAlias(aliasName))
    const prevMinerIdSig = bsv.crypto.ECDSA.sign(hash, prevMinerIdPrivateKey)
    revocationData["prevMinerIdSig"] = prevMinerIdSig.toString('hex')
  } else {
    // Store an information about the current prevMinerId key as it will be normalised.
    const prevMinerId = getMinerIdPublicKey(getPreviousMinerIdAlias(aliasName))
    revocationData["prevMinerId"] = prevMinerId.toString('hex')
    // The minerId key is rotated. Use the previous miner ID private key to create sig2.
    const prevMinerIdPrivateKey = getMinerIdPrivateKey(getPreviousMinerIdAlias(aliasName))
    // Create revocationMessageSig2.
    revocationMessageSig2 = bsv.crypto.ECDSA.sign(revocationMessageHash, prevMinerIdPrivateKey)
  }
  revocationData.revocationMessageSig["sig2"] = revocationMessageSig2.toString('hex')
  // Write data to the file.
  _writeJsonDataToFile(aliasName, revocationData, MINERID_REVOCATION_DATA_FILENAME)
}

/**
 * The function reads data from the MINERID_REVOCATION_DATA_FILENAME file
 * required to construct the miner-info revocation document.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @returns A null or an object containing minerId revocation data.
 */
function readMinerIdRevocationDataFromFile (aliasName) {
  const minerIdRevocationData = _readDataFromJsonFile(aliasName, MINERID_REVOCATION_DATA_FILENAME)
  if (!minerIdRevocationData) {
    return
  }
  _checkRequiredDataField(minerIdRevocationData, "complete_revocation", MINERID_REVOCATION_DATA_FILENAME)
  _checkRequiredDataField(minerIdRevocationData, "revocationMessage", MINERID_REVOCATION_DATA_FILENAME)
  _checkRequiredDataField(minerIdRevocationData.revocationMessage, "compromised_minerId", MINERID_REVOCATION_DATA_FILENAME)
  _checkRequiredDataField(minerIdRevocationData, "revocationMessageSig", MINERID_REVOCATION_DATA_FILENAME)
  _checkRequiredDataField(minerIdRevocationData.revocationMessageSig, "sig1", MINERID_REVOCATION_DATA_FILENAME)
  _checkRequiredDataField(minerIdRevocationData.revocationMessageSig, "sig2", MINERID_REVOCATION_DATA_FILENAME)
  return minerIdRevocationData
}

// Removes the MINERID_REVOCATION_DATA_FILENAME file.
function deleteMinerIdRevocationDataFile (aliasName) {
  const filePath = path.join(process.env.HOME, filedir, aliasName, MINERID_REVOCATION_DATA_FILENAME)
  fs.unlink(filePath, (err) => {
    if (err) throw err;
    console.debug(`${filePath} was deleted`);
  });
}

// Common non-exported utility functions to support aliases.
function _getCurrentAlias (aliasName, aliasFileName) {
  const data = _getAliases(aliasName, aliasFileName)
  if (data && data.length > 0) {
    return data[data.length - 1].name
  }
  return null
}

function _getPreviousAlias (aliasName, aliasFileName) {
  const data = _getAliases(aliasName, aliasFileName)
  if (!data) {
    return null
  }
  if (data.length > 1) {
    return data[data.length - 2].name
  } else if (data.length > 0) {
    return data[data.length - 1].name
  }
}

function _getAliases (aliasName, aliasFileName) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, aliasFileName)
  if (!fs.existsSync(filePath)) {
    return
  }
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (e) {
    console.error('Getting aliases: ', e)
    return
  }
  return data
}

// MinerId alias support.
function getCurrentMinerIdAlias (aliasName) {
  return _getCurrentAlias(aliasName, MINERID_ALIASES_FILENAME)
}

function getPreviousMinerIdAlias(aliasName) {
  return _getPreviousAlias(aliasName, MINERID_ALIASES_FILENAME)
}

// Revocation Key alias support.
function getCurrentRevocationKeyAlias(aliasName) {
  return _getCurrentAlias(aliasName, REVOCATIONKEY_ALIASES_FILENAME)
}

function getPreviousRevocationKeyAlias(aliasName) {
  return _getPreviousAlias(aliasName, REVOCATIONKEY_ALIASES_FILENAME)
}

function makeDirIfNotExists (folderPath) {
  try {
    if (fs.existsSync(folderPath)) {
      return
    }
  } catch (err) { }

  fs.mkdirSync(folderPath, { recursive: true })
}

function _saveAlias (aliasName, alias, aliasFileName) {
  const homeDir = process.env.HOME
  const folderPath = path.join(homeDir, filedir, aliasName)
  const filePath = path.join(folderPath, aliasFileName)

  let data
  try {
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath))
    } else {
      makeDirIfNotExists(folderPath)
    }
  } catch (e) {
    console.error('Saving current alias: ', e)
    return
  }
  if (!data) {
    data = []
  }
  data.push({ name: alias })
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
    throw new Error(`Writing alias to file ${filePath}`)
  }
}

function saveMinerIdAlias(aliasName, alias) {
  _saveAlias(aliasName, alias, MINERID_ALIASES_FILENAME)
}

function saveRevocationKeyAlias(aliasName, alias) {
  _saveAlias(aliasName, alias, REVOCATIONKEY_ALIASES_FILENAME)
}

function incrementAliasPrefix(currentAlias) {
  const aliasParts = currentAlias.split('_')
  // increment alias prefix
  let nr = aliasParts.pop()
  aliasParts.push(++nr)
  return aliasParts.join('_')
}

// MinerId optional data support.
function updateMinerContactData (aliasName, name, value) {
  if (!aliasExists(aliasName)) {
    console.error(`Name "${aliasName}" doesn't exist.`)
    return
  }
  console.log(`updateMinerContactData: ${name}, ${value}`)
  writeMinerContactDataToFile(aliasName, name, value)
}

/**
 * The function writes minerContact details into the MINERID_OPTIONAL_DATA_FILENAME file.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @param name (string) Key to be added.
 * @param value (string) Value assigned to the key.
 */
function writeMinerContactDataToFile (aliasName, name, value) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, MINERID_OPTIONAL_DATA_FILENAME)
  let data = {}
  try {
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath))
      if (!data.hasOwnProperty('minerContact')) {
        data.minerContact = {}
      }
    } else {
      data.minerContact = {}
    }
    data.minerContact[name] = value
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error(err)
    throw new Error(`Writing config key to file ${filePath}`)
  }
}

// Writes minerId data into the MINERID_DATA_FILENAME file.
function writeMinerIdDataToFile(aliasName, minerIdData) {
  _writeJsonDataToFile(aliasName, minerIdData, MINERID_DATA_FILENAME)
}

// Updates the MINERID_DATA_FILENAME file based on the given arguments.
function updateKeysInfoInMinerIdDataFile2 (aliasName, minerIdData, prevMinerId, minerId, prevMinerIdSig) {
  minerIdData["prevMinerId"] = prevMinerId
  minerIdData["minerId"] = minerId
  minerIdData["prevMinerIdSig"] = prevMinerIdSig
  writeMinerIdDataToFile(aliasName, minerIdData)
  return minerIdData
}

// Updates the MINERID_DATA_FILENAME file.
function updateKeysInfoInMinerIdDataFile (aliasName) {
  let minerIdData = {}
  minerIdData = readMinerIdDataFromFile(aliasName)
  const minerId = getMinerIdPublicKey(getCurrentMinerIdAlias(aliasName))
  const prevMinerId = getMinerIdPublicKey(getPreviousMinerIdAlias(aliasName))
  const hash = bsv.crypto.Hash.sha256(cm.concatFields(prevMinerId, minerId))
  const prevMinerIdPrivateKey = getMinerIdPrivateKey(getPreviousMinerIdAlias(aliasName))
  const prevMinerIdSig = bsv.crypto.ECDSA.sign(hash, prevMinerIdPrivateKey).toString('hex')
  return updateKeysInfoInMinerIdDataFile2(aliasName, minerIdData, prevMinerId, minerId, prevMinerIdSig)
}

// Reads data from the MINERID_OPTIONAL_DATA_FILENAME file.
function readOptionalMinerIdData (aliasName) {
  return _readDataFromJsonFile(aliasName, MINERID_OPTIONAL_DATA_FILENAME)
}

// Reads data from the MINERID_DATA_FILENAME file.
function readMinerIdDataFromFile (aliasName) {
  return _readDataFromJsonFile(aliasName, MINERID_DATA_FILENAME)
}

/**
 * This function is an extension to the readMinerIdDataFromFile function.
 *
 * Operations executed:
 * 1. Reads a minerId key related data.
 * 2. Checks if 'prevMinerId' data field needs to be normalised.
 * 2.1 Normalises the data field if it is required.
 * 3. Returns correct minerId key data.
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @returns (an object) minerId key data fields.
 */
async function readMinerIdDataAndUpdateMinerIdKeysStatus (aliasName) {
  function _normalisePrevMinerId (aliasName, minerIdData) {
    // The first miner-info document (after the minerId key rotation) is forming a new Miner ID reputation chain.
    // It sets 'prevMinerId' to the same value as 'minerId' field.
    const minerId = minerIdData["minerId"]
    const prevMinerId = minerId
    const hash = bsv.crypto.Hash.sha256(cm.concatFields(prevMinerId, minerId))
    const minerIdPrivateKey = getMinerIdPrivateKey(getCurrentMinerIdAlias(aliasName))
    const prevMinerIdSig = bsv.crypto.ECDSA.sign(hash, minerIdPrivateKey).toString('hex')
    return updateKeysInfoInMinerIdDataFile2(aliasName, minerIdData, prevMinerId, minerId, prevMinerIdSig)
  }
  let minerIdData = {}
  minerIdData = readMinerIdDataFromFile(aliasName)
  if (minerIdData &&
    minerIdData.hasOwnProperty('prevMinerId') &&
    minerIdData.hasOwnProperty('minerId') &&
    minerIdData.hasOwnProperty('prevMinerIdSig')) {
    if (minerIdData["prevMinerId"] != minerIdData["minerId"]) {
      // Check if a minerId rotation is confirmed on the blockchain.
      if (await cb.checkMinerIdKeysConfirmed(minerIdData["minerId"], minerIdData["prevMinerId"], "CURRENT")) {
        return _normalisePrevMinerId(aliasName, minerIdData)
      }
    }
  } else {
    return updateKeysInfoInMinerIdDataFile(aliasName)
  }
  return minerIdData
}

// Reads 'opreturn_status' from the MINERID_DATA_FILENAME file.
function readOpReturnStatusFromFile (aliasName) {
  minerIdData = readMinerIdDataFromFile(aliasName)
  _checkRequiredDataField(minerIdData, "opreturn_status", MINERID_DATA_FILENAME)
  return minerIdData["opreturn_status"]
}

// Writes 'opreturn_status' into the MINERID_DATA_FILENAME file.
function writeOpReturnStatusToFile (aliasName, opReturnStatus) {
  minerIdData = readMinerIdDataFromFile(aliasName)
  minerIdData["opreturn_status"] = opReturnStatus
  writeMinerIdDataToFile(aliasName, minerIdData)
}

// Reads dataRefs tx configuration from the DATAREFS_TX_DATA_FILENAME file.
function readDataRefsTxFile(aliasName) {
  try {
    const txData = _readDataFromJsonFile(aliasName, DATAREFS_TX_DATA_FILENAME)
    if (txData) {
      _checkRequiredDataField(txData, "dataRefs", DATAREFS_TX_DATA_FILENAME)
      _checkRequiredDataField(txData.dataRefs, "refs", DATAREFS_TX_DATA_FILENAME)
      if (!Array.isArray(txData.dataRefs.refs)) {
        throw new Error(`"dataRefs.refs" data field in the "${DATAREFS_TX_DATA_FILENAME}" config file must be an array!`)
      }
      txData.dataRefs.refs.forEach(
        function(obj) {
          _checkRequiredDataField(obj, "brfcIds", DATAREFS_TX_DATA_FILENAME)
          _checkRequiredDataField(obj, "data", DATAREFS_TX_DATA_FILENAME)
          if (JSON.stringify(obj.data) === '{}') {
            throw new Error(`"dataRefs.refs.data" data field in the "${DATAREFS_TX_DATA_FILENAME}" config file must be a non-empty json object!`)
	  }
          obj.brfcIds.forEach(
            function(id) {
               if (!/^[A-F0-9]{12}$/i.test(id)) {
                 throw new Error(`"dataRefs.refs.brfcIds" data field in the "${DATAREFS_TX_DATA_FILENAME}" config file must be a valid BRFC ID!`)
	       }
              _checkRequiredDataField(obj.data, id, DATAREFS_TX_DATA_FILENAME) })
          _checkRequiredDataField(obj, "vout", DATAREFS_TX_DATA_FILENAME)
          if (!/^\d+$/i.test(obj.vout)) {
            throw new Error(`"dataRefs.refs.vout" data field in the "${DATAREFS_TX_DATA_FILENAME}" config file must be a valid outpoint number!`)
          }
      })
    }
    return txData
  } catch (e) {
    console.log('Error reading dataRefsTx configuration: ', e)
    return null
  }
}

/**
 * The function creates the DATAREFS_DATA_FILENAME file based on:
 * (a) the DATAREFS_TX_DATA_FILENAME file configuration
 * (b) specified dataRefsTxId argument
 *
 * @param aliasName (string) A Miner ID alias to use.
 * @param dataRefsTxId (optional hex-string) DataRefs transaction id.
 */
function createDataRefsFile(aliasName, dataRefsTxId) {
  if (dataRefsTxId === undefined) {
    return
  }
  try {
    const txData = readDataRefsTxFile(aliasName)
    if (txData) {
      let data = {}
      let refs = []
      txData.dataRefs.refs.forEach(
        function(obj) {
          let refObj = {}
          refObj["brfcIds"] = obj.brfcIds
          refObj["txid"] = dataRefsTxId
          refObj["vout"] = obj.vout
          refs.push(refObj)
      })
      data.dataRefs = {}
      data.dataRefs["refs"] = refs
      _writeJsonDataToFile(aliasName, data, DATAREFS_DATA_FILENAME)
    }
  } catch (e) {
    console.error('Creating dataRefs configuration: ', e)
  }
}

// Reads configuration from the DATAREFS_DATA_FILENAME file.
function readDataRefsFromFile(aliasName) {
  let data = {}
  try {
    data = _readDataFromJsonFile(aliasName, DATAREFS_DATA_FILENAME)
    if (data) {
      _checkRequiredDataField(data, "dataRefs", DATAREFS_DATA_FILENAME)
      _checkRequiredDataField(data.dataRefs, "refs", DATAREFS_DATA_FILENAME)
      if (!Array.isArray(data.dataRefs.refs)) {
        throw new Error(`"dataRefs.refs" data field in the "${DATAREFS_DATA_FILENAME}" config file must be an array!`)
      }
      data.dataRefs.refs.forEach(
        function(obj) {
         _checkRequiredDataField(obj, "brfcIds", DATAREFS_DATA_FILENAME)
         obj.brfcIds.forEach(
           function(id) {
             if (!/^[A-F0-9]{12}$/i.test(id)) {
               throw new Error(`"dataRefs.refs.brfcIds" data field in the "${DATAREFS_DATA_FILENAME}" config file must be a valid BRFC ID!`)
	     }
	 })
         _checkRequiredDataField(obj, "txid", DATAREFS_DATA_FILENAME)
         if (!/^[A-F0-9]{64}$/i.test(obj.txid)) {
           throw new Error(`"dataRefs.refs.txid" data field in the "${DATAREFS_DATA_FILENAME}" config file must be a valid transaction id!`)
	 }
         _checkRequiredDataField(obj, "vout", DATAREFS_DATA_FILENAME)
         if (!/^\d+$/i.test(obj.vout)) {
           throw new Error(`"dataRefs.refs.vout" data field in the "${DATAREFS_DATA_FILENAME}" config file must be a valid outpoint number!`)
	 }
      })
    }
  } catch (e) {
    console.error('Reading dataRefs configuration: ', e)
    return null
  }
  return data
}

// Makes a copy of the old aliases file and gives the copy a new expected name
// (only if the source file does exist and the target file doesn't).
function copyAliasesFile(aliasName) {
  const oldFilePath = path.join(process.env.HOME, filedir, aliasName, "aliases")
  if (!fs.existsSync(oldFilePath)) {
    console.error(`Old protocol data: file ${oldFilePath} doesn't exist.`)
    return false
  }
  const newFilePath = path.join(process.env.HOME, filedir, aliasName, MINERID_ALIASES_FILENAME)
  if (fs.existsSync(newFilePath)) {
    console.error(`New protocol data: file ${newFilePath} does exist.`)
    return false
  }
  try {
    fs.copyFile(oldFilePath, newFilePath, (err) => {
      if (err) {
        throw err;
      }
    });
  } catch (err) {
    console.error(`Copy operation has failed: ${err}`)
    return false
  }
  return true
}

module.exports = {
  aliasExists,

  createMinerId,
  getMinerIdPrivateKey,
  getMinerIdPublicKey,

  createRevocationKey,
  getRevocationKeyPrivateKey,
  getRevocationKeyPublicKey,

  minerIdKeyExists,
  revocationKeyExists,

  readRevocationKeyDataFromFile,
  readRevocationKeyDataAndUpdateKeysStatus,
  writeRevocationKeyDataToFile,
  updateRevocationKeyData,

  createMinerIdRevocationData,
  readMinerIdRevocationDataFromFile,
  deleteMinerIdRevocationDataFile,

  getCurrentMinerIdAlias,
  getPreviousMinerIdAlias,
  saveMinerIdAlias,

  getCurrentRevocationKeyAlias,
  getPreviousRevocationKeyAlias,
  saveRevocationKeyAlias,

  incrementAliasPrefix,

  updateMinerContactData,
  writeMinerContactDataToFile,
  writeMinerIdDataToFile,
  updateKeysInfoInMinerIdDataFile2,
  updateKeysInfoInMinerIdDataFile,
  readOptionalMinerIdData,
  readMinerIdDataFromFile,
  readMinerIdDataAndUpdateMinerIdKeysStatus,

  readOpReturnStatusFromFile,
  writeOpReturnStatusToFile,

  readDataRefsTxFile,
  createDataRefsFile,
  readDataRefsFromFile,

  copyAliasesFile
}
