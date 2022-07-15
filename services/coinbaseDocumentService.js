const bsv = require('bsv')
const request = require('request-promise')
const config = require('config')
const fm = require('../utils/filemanager')
const bitcoin = require('bitcoin-promise')
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

function generateMinerId (aliasName) {
  // the first alias has an underscore 1 appended so other aliases increment
  const alias = aliasName + '_1'
  try {
    // Check if aliasName is unused.
    const existsMinerId = fm.getMinerIdPublicKey(alias)
    if (existsMinerId) {
      console.log(`miner alias "${aliasName}" already exists: `)
      console.log(existsMinerId)
      console.log('Please choose another one.')
      return false
    }
    const existsRevocationKey = fm.getRevocationKeyPublicKey(alias)
    if (existsRevocationKey) {
      console.log(`miner alias "${aliasName}" is linked to the existing revocationKey: `)
      console.log(existsRevocationKey)
      console.log('Please choose another one.')
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
    // Save the first minerId public key.
    let firstMinerId = {}
    firstMinerId["first_minerId"] = minerId
    fm.writeMinerIdDataToFile(aliasName, firstMinerId)
  } catch (err) {
    console.log('Please check that the signing_service is running properly...')
    console.log('generateMinerId error: ', err)
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

/* Create a new minerId
   Don't return anything but the subsequent coinbase documents will contain both minerIds (now including the new one)
*/

function _checkAliasExists(aliasName) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return false
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return false
  }
  return true
}

function _checkCurrentMinerIdPrivateKeyExists (aliasName) {
  // get current alias
  const currentAlias = fm.getCurrentMinerIdAlias(aliasName)
  if (!currentAlias) {
    console.log(`Error: The minerId key alias "${aliasName}" doesn't exist.`)
    return false
  }
  // Check if the current minerId key is present in the key store.
  if (!fm.minerIdKeyExists(currentAlias)) {
    console.log(`Error: The "${currentAlias}.key" minerId private key is not available in the key store.`)
    return false
  }
  return true
}

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
  } catch (err) {
    console.log('error rotating minerId: ', err)
    return false
  }
  return true
}

// Check if the revocationKey is available.
function _checkCurrentRevocationPrivateKeyExists (aliasName) {
  // get current alias
  const currentAlias = fm.getCurrentRevocationKeyAlias(aliasName)
  if (!currentAlias) {
    console.log(`Error: The revocation key alias "${aliasName}" doesn't exist.`)
    return false
  }
  // Check if the current revocation key is present in the revocation key store.
  if (!fm.revocationKeyExists(currentAlias)) {
    console.log(`Error: The "${currentAlias}.key" revocation private key is not available in the key store.`)
    return false
  }
  return true
}

// Rotate the current revocation key.
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
  } catch (err) {
    console.log('Error rotating revocation key: ', err)
    return false
  }
  return true
}

// Revoke the given minerId public key.
function revokeMinerId (aliasName, minerIdPubKey, isCompleteRevocation) {
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
    if (!isCompleteRevocation) {
      const minerIdData = fm.readMinerIdDataFromFile(aliasName)
      if (!minerIdData.hasOwnProperty('first_minerId')) {
        console.log('Cannot find "first_minerId" in the config file.')
        return false
      }
      if (minerIdData["first_minerId"] == minerIdPubKey) {
        console.log('An attempt to terminate the entire Miner ID reputation chain.')
        return false
      }
      if (rotateMinerId(aliasName)) {
        console.log('The compromised minerId has been rotated successfully.')
      } else {
        console.log("The compromised minerId key rotation has failed!")
        return false
      }
    }
    fm.createMinerIdRevocationData (aliasName, minerIdPubKey, isCompleteRevocation)
  } catch (err) {
    console.log('Error revoking minerId: ', err)
    return false
  }
  return true
}

// Check if minerId protocol can be upgraded.
function canUpgradeMinerIdProtocol (aliasName) {
  if (!_checkAliasExists(aliasName)) {
    return false
  }
  try {
    // Check if the key needed to create revocationMessageSig:sig2 exists.
    if (!_checkCurrentMinerIdPrivateKeyExists(aliasName)) {
      return false
    }
    // Check revocationKey conditions.
    {
      // get current revocation key alias
      const currentAlias = fm.getCurrentRevocationKeyAlias(aliasName)
      if (currentAlias) {
        console.log(`Error: minerId is already upgraded. The revocation key alias "${currentAlias}" does exist.`)
        return false
      }
      // Check if the initial revocationKey private key is present in the revocation key store.
      if (fm.revocationKeyExists(aliasName+'_1')) {
        console.log(`Error: minerId is already upgraded. The "${aliasName}_1.key" revocation private key is available in the key store.`)
	return false
      }
    }
  } catch (err) {
    console.log('Error upgrading minerId protocol data: ', err)
    return false
  }
  return true
}

function createMinerInfoDocument (aliasName, height) {
  const minerId = fm.getMinerIdPublicKey(fm.getCurrentMinerIdAlias(aliasName))
  const prevMinerId = fm.getMinerIdPublicKey(fm.getPreviousMinerIdAlias(aliasName))

  const prevRevocationKey = fm.readPrevRevocationKeyPublicKeyFromFile(aliasName)
  const revocationKey = fm.readRevocationKeyPublicKeyFromFile(aliasName)

  const minerIdSigPayload = Buffer.concat([
    Buffer.from(prevMinerId, 'hex'),
    Buffer.from(minerId, 'hex')
  ])

  const prevMinerIdSig = sign(minerIdSigPayload, fm.getPreviousMinerIdAlias(aliasName))
  const prevRevocationKeySig = fm.readPrevRevocationKeySigFromFile(aliasName)

  let doc = {
    version: cbdVersion,
    height: height,

    prevMinerId: prevMinerId,
    prevMinerIdSig: prevMinerIdSig,

    minerId: minerId,

    prevRevocationKey: prevRevocationKey,
    revocationKey: revocationKey,
    prevRevocationKeySig: prevRevocationKeySig
  }

  // TODO: Add a callback to check if a block with the revocation message is alredy mined.
  const minerIdRevocationData = fm.readMinerIdRevocationDataFromFile(aliasName)
  if (minerIdRevocationData) {
    if (minerIdRevocationData["complete_revocation"]) {
      doc.prevMinerId = minerIdRevocationData["prevMinerId"]
      doc.prevMinerIdSig = minerIdRevocationData["prevMinerIdSig"]
    }
    doc.revocationMessage = {}
    doc.revocationMessage = minerIdRevocationData.revocationMessage
    doc.revocationMessageSig = {}
    doc.revocationMessageSig = minerIdRevocationData.revocationMessageSig
  }

  const optionalData = fm.readOptionalMinerIdData(aliasName)
  if (optionalData) {
    doc = { ...doc, ...optionalData}
  }

  return doc
}

async function createMinerInfoOpReturn (height, aliasName) {
  if (!aliasName || aliasName === '') {
    console.log('Must supply an alias')
    return
  }
  if (!fm.aliasExists(aliasName)) {
    console.log(`Name "${aliasName}" doesn't exist.`)
    return
  }
  if (height < 1) {
    console.log('Must enter a valid height')
    return
  }

  const doc = createMinerInfoDocument(aliasName, parseInt(height))
  console.debug('Miner-info doc:\n' + JSON.stringify(doc))

  const payload = JSON.stringify(doc)
  const signature = sign(Buffer.from(payload), fm.getCurrentMinerIdAlias(aliasName))
  console.debug('Miner-info-doc sig:\n' + signature.toString('hex'))

  const opReturnScript = mi.createMinerInfoOpReturnScript(payload, signature).toHex()
  return opReturnScript
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
 * @param minerInfoTxId (hex string) An existing miner-info transaction id.
 * @param prevhash (hex string) Hash of the previous block.
 * @param merkleProof (list of hex strings) Merkle branches from the mining candidate.
 * @param coinbase2 (hex string) The 2nd part of the coinbase tx.
 * @returns (hex string) coinbase2 extended by (1)-(3) data.
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

module.exports = {
  createNewCoinbase2: createCoinbase2,
  createMinerInfoOpReturn,
  generateMinerId,
  rotateMinerId,
  rotateRevocationKey,
  revokeMinerId,
  canUpgradeMinerIdProtocol,
  getCurrentMinerId,
  signWithCurrentMinerId
}
