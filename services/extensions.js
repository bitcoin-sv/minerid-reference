const fs = require('fs')
const path = require('path')

const pluginPath = 'active-plugins'

function addExtensions (doc, coinbase2, jobData = {}) {
  const pluginFiles = fs.readdirSync(pluginPath)
  const extensions = {}

  jobData.coinbase2 = coinbase2

  // run each extension plugin in order to add data to the extensions object
  // if the data needed for that extension is provided in jobData
  pluginFiles.forEach(pluginFile => {
    const pluginFilePath = path.join(__dirname, '../', pluginPath, pluginFile)
    require(pluginFilePath)({ extensions, jobData })
  })

  if (Object.keys(extensions).length !== 0) {
    doc.extensions = extensions
  }
}

// placeholderCB1 is the zeroed out initial part of the coinbase shown in the blockbind BRFC
// see: https://github.com/bitcoin-sv-specs/brfc-minerid/tree/master/extensions/blockbind
//
// version:       01000000
// input count:   01
// previous hash: 0000000000000000000000000000000000000000000000000000000000000000
// index:         ffffffff
// script length: 08
// scriptSig:     0000000000000000
const placeholderCB1 = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff080000000000000000'

module.exports = {
  addExtensions,
  placeholderCB1
}
