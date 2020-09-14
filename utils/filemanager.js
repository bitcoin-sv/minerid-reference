const fs = require('fs')
const path = require('path')
const bsv = require('bsv')

const configFilename = 'config'

const config = require('config')
var filedir = config.get('minerIdDataPath')
const keystorePath = config.get('keystorePath')
const vcTxFilename = 'vctx'

const aliasFilename = 'aliases'

function aliasExists (aliasName) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName)

  if (fs.existsSync(filePath)) {
    return true
  }
  return false
}

function createMinerId (alias) {
  const xpriv = bsv.HDPrivateKey()

  const dir = path.join(process.env.HOME, keystorePath)
  makeDirIfNotExists(dir)

  const filePath = path.join(dir, alias + '.key')
  fs.writeFileSync(filePath, xpriv.toString())
}

function getPrivateKey (alias) {
  const dir = path.join(process.env.HOME, keystorePath)
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

function getMinerId (alias) {
  const privateKey = getPrivateKey(alias)
  if (privateKey) {
    return privateKey.publicKey.toString()
  }
  return null
}

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

function updateOptionalMinerData (aliasName, name, value) {
  if (!aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  console.log(`updateOptionalMinerData: ${name}, ${value}`)
  writeOptionalMinerDataToFile(aliasName, name, value)
}

function writeOptionalMinerDataToFile (aliasName, name, value) {
  const homeDir = process.env.HOME
  const filePath = path.join(homeDir, filedir, aliasName, configFilename)
  let data = {}
  try {
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath))
    }
    data[name] = value
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
  getOrCreatePrivKey,
  writePrivKeyToFile,
  copyPrivKey,

  getVctxFromFile,
  writeVctxToFile,

  getCurrentAlias,
  getPreviousAlias,
  saveAlias,

  updateOptionalMinerData,
  writeOptionalMinerDataToFile,
  getOptionalMinerData
}
