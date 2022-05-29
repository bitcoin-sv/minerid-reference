const fs = require('fs')
const path = require('path')
const bsv = require('bsv')

const configFilename = 'config'

const config = require('config')
var filedir = config.get('minerIdDataPath')
const keystorePath = config.get('keystorePath')
const revocationKeystorePath = config.get('revocationKeystorePath')
const vcTxFilename = 'vctx'

const aliasFilename = 'aliases'

const REVOCATION_KEY_DATA_FILENAME = 'revocationKeyData'

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

function getMinerId (alias) {
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
function getOrCreatePrivKey (aliasName, filename) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, filename)
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (e) {
    const dir = path.join(homeDir, filedir, aliasName)
    makeDirIfNotExists(dir)

    data = { prv: bsv.PrivateKey.fromRandom().toString() }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  }

  if (!data.prv) {
    throw new Error('Invalid private key.')
  }

  return bsv.PrivateKey.fromString(data.prv)
}

// the file should store an array of private keys or an xpub and a path.
function writePrivKeyToFile (aliasName, filename, privKey) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, filename)
  let data
  try {
    data = { prv: privKey }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (err) {
    throw new Error('Error writing private key to file ' + filePath)
  }
}

function copyPrivKey (aliasName, sourceFilename, destinationFilename) {
  const homeDir = process.env.HOME
  const sourceFilePath = path.join(homeDir, filedir, aliasName, sourceFilename)
  const destinationFilePath = path.join(homeDir, filedir, aliasName, destinationFilename)
  fs.copyFile(sourceFilePath, destinationFilePath, (err) => {
    if (err) throw err
    console.log(`${sourceFilename} was copied to ${destinationFilename}`)
  })
}

function getVctxFromFile (aliasName) {
  return _getVctxFromFile(aliasName, vcTxFilename)
}

function _getVctxFromFile (aliasName, filename) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, filename)
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (e) {
    return
  }

  return data ? data.txid : null
}

function writeVctxToFile (aliasName, vtcx) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, vcTxFilename)
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
    if (!data) {
      console.log('writeVctxToFile: data doesn\'t exist')
      return
    }
    data.txid = vtcx
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch (e) {
    console.log('writeVctxToFile: file doesn\'t exist')
  }
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
  const prevRevocationKeyPublicKey = getRevocationKeyPublicKey(getPreviousAlias(aliasName))
  revocationKeyData["prevRevocationKey"] = prevRevocationKeyPublicKey.toString('hex')
  // revocationKey
  const revocationKeyPublicKey = getRevocationKeyPublicKey(getCurrentAlias(aliasName))
  revocationKeyData["revocationKey"] = revocationKeyPublicKey.toString('hex')
  // prevRevocationKeySig
  const payload = Buffer.concat([
    Buffer.from(prevRevocationKeyPublicKey, 'hex'),
    Buffer.from(revocationKeyPublicKey, 'hex')
  ])
  const hash = bsv.crypto.Hash.sha256(payload)
  const privateKey = getRevocationKeyPrivateKey(getPreviousAlias(aliasName))
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

function getCurrentAlias (aliasName) {
  const data = _getAliases(aliasName)
  if (data && data.length > 0) {
    return data[data.length - 1].name
  }
  return null
}

function getPreviousAlias (aliasName) {
  const data = _getAliases(aliasName)
  if (!data) {
    return null
  }
  if (data.length > 1) {
    return data[data.length - 2].name
  } else if (data.length > 0) {
    return data[data.length - 1].name
  }
}

function _getAliases (aliasName) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, aliasFilename)
  let data
  try {
    data = JSON.parse(fs.readFileSync(filePath))
  } catch (e) {
    console.log('error getting aliases: ', e)
    return
  }
  return data
}

function makeDirIfNotExists (folderPath) {
  try {
    if (fs.existsSync(folderPath)) {
      return
    }
  } catch (err) { }

  fs.mkdirSync(folderPath, { recursive: true })
}

function saveAlias (aliasName, alias) {
  const homeDir = process.env.HOME
  const folderPath = path.join(homeDir, filedir, aliasName)
  const filePath = path.join(folderPath, aliasFilename)

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
  getMinerId,

  createRevocationKey,
  getRevocationKeyPrivateKey,
  getRevocationKeyPublicKey,

  getOrCreatePrivKey,
  writePrivKeyToFile,
  copyPrivKey,

  getVctxFromFile,
  writeVctxToFile,

  readPrevRevocationKeyPublicKeyFromFile,
  readRevocationKeyPublicKeyFromFile,
  readPrevRevocationKeySigFromFile,
  writeRevocationKeyDataToFile,

  getCurrentAlias,
  getPreviousAlias,
  saveAlias,

  updateMinerContactData,
  writeMinerContactDataToFile,
  getOptionalMinerData
}
