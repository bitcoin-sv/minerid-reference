const fs = require('fs')
const path = require('path')
const bsv = require('bsv')

const configFilename = 'config'

const config = require('config')
var filedir = config.get('minerIdDataPath')
const keystorePath = config.get('keystorePath')
const revocationKeystorePath = config.get('revocationKeystorePath')

const MINERID_ALIASES_FILENAME = 'aliases'
const REVOCATIONKEY_ALIASES_FILENAME = 'revocationKeyAliases'

const REVOCATION_KEY_DATA_FILENAME = 'revocationKeyData'

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
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  const filePath = path.join(process.env.HOME, filedir, aliasName, fileName)
  if (!fs.existsSync(filePath)) {
    console.log(`File "${filePath}" doesn't exist.`)
    return
  }
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (err) {
    console.log(`Error: Reading data from the file ${filePath}`, err)
    return
  }
  return data
}

function _writeJsonDataToFile (aliasName, data, fileName) {
  const filePath = path.join(process.env.HOME, filedir, aliasName, fileName)
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    throw new Error(`Error: Writing json data to the file ${filePath}`)
  }
}

/**
 * Basic MinerId key exported functions.
 */
function createMinerId (alias) {
  _createKey(alias, keystorePath)
}

function getPrivateKey (alias) {
  return _getPrivateKey(alias, keystorePath)
}

function getMinerIdPublicKey (alias) {
  return _getPublicKey(getPrivateKey(alias))
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

function revocationKeyExists(alias) {
  return _checkIfKeyExists(alias, revocationKeystorePath)
}

// Read 'prevRevocationKey' public key from the config file.
function readPrevRevocationKeyPublicKeyFromFile (aliasName) {
  const data = _readDataFromJsonFile(aliasName, REVOCATION_KEY_DATA_FILENAME)
  if (!data.hasOwnProperty('prevRevocationKey')) {
    throw new Error(`Missing "prevRevocationKey" data field in the "${REVOCATION_KEY_DATA_FILENAME}" config file.`)
  }
  return data["prevRevocationKey"]
}

// Read 'revocationKey' public key from the config file.
function readRevocationKeyPublicKeyFromFile (aliasName) {
  const data = _readDataFromJsonFile(aliasName, REVOCATION_KEY_DATA_FILENAME)
  if (!data.hasOwnProperty('revocationKey')) {
    throw new Error(`Missing "revocationKey" data field in the "${REVOCATION_KEY_DATA_FILENAME}" config file.`)
  }
  return data["revocationKey"]
}

// Write 'prevRevocationKey', 'revocationKey' public keys and 'prevRevocationKeySig' to the file.
function writeRevocationKeyDataToFile (aliasName) {
  let revocationKeyData = {}
  // prevRevocationKey
  const prevRevocationKeyPublicKey = getRevocationKeyPublicKey(getPreviousRevocationKeyAlias(aliasName))
  revocationKeyData["prevRevocationKey"] = prevRevocationKeyPublicKey
  // revocationKey
  const revocationKeyPublicKey = getRevocationKeyPublicKey(getCurrentRevocationKeyAlias(aliasName))
  revocationKeyData["revocationKey"] = revocationKeyPublicKey
  // prevRevocationKeySig
  const payload = Buffer.concat([
    Buffer.from(prevRevocationKeyPublicKey, 'hex'),
    Buffer.from(revocationKeyPublicKey, 'hex')
  ])
  const hash = bsv.crypto.Hash.sha256(payload)
  const privateKey = getRevocationKeyPrivateKey(getPreviousRevocationKeyAlias(aliasName))
  const prevRevocationKeySig = bsv.crypto.ECDSA.sign(hash, privateKey)
  revocationKeyData["prevRevocationKeySig"] = prevRevocationKeySig.toString('hex')
  // Write revocationKeyData to the file.
  _writeJsonDataToFile(aliasName, revocationKeyData, REVOCATION_KEY_DATA_FILENAME)
}

// Read 'prevRevocationKeySig' signature from the config file.
function readPrevRevocationKeySigFromFile (aliasName) {
  const data = _readDataFromJsonFile(aliasName, REVOCATION_KEY_DATA_FILENAME)
  if (!data.hasOwnProperty('prevRevocationKeySig')) {
    throw new Error(`Missing "prevRevocationKeySig" data field in the "${REVOCATION_KEY_DATA_FILENAME}" config file.`)
  }
  return data["prevRevocationKeySig"]
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
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (e) {
    console.log('error getting aliases: ', e)
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
    console.log('error saving current alias: ', e)
    return
  }
  if (!data) {
    data = []
  }
  data.push({ name: alias })
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.log(err)
    throw new Error(`Error writing alias to file ${filePath}`)
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
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  console.log(`updateMinerContactData: ${name}, ${value}`)
  writeMinerContactDataToFile(aliasName, name, value)
}

function writeMinerContactDataToFile (aliasName, name, value) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, configFilename)
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
    throw new Error(`Error writing config key to file ${filePath}`)
  }
}

function getOptionalMinerData (aliasName) {
  if (!aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, configFilename)
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (e) {
    return
  }
  return data
}

module.exports = {
  aliasExists,

  createMinerId,
  getPrivateKey,
  getMinerIdPublicKey,

  createRevocationKey,
  getRevocationKeyPrivateKey,
  getRevocationKeyPublicKey,
  revocationKeyExists,

  readPrevRevocationKeyPublicKeyFromFile,
  readRevocationKeyPublicKeyFromFile,
  readPrevRevocationKeySigFromFile,
  writeRevocationKeyDataToFile,

  getCurrentMinerIdAlias,
  getPreviousMinerIdAlias,
  saveMinerIdAlias,

  getCurrentRevocationKeyAlias,
  getPreviousRevocationKeyAlias,
  saveRevocationKeyAlias,

  incrementAliasPrefix,

  updateMinerContactData,
  writeMinerContactDataToFile,
  getOptionalMinerData
}
