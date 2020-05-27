const fs = require('fs')
const path = require('path')

const pluginPath = 'active-plugins'

function addExtensions (doc, coinbase1, coinbase2, jobData = {}) {
  const pluginFiles = fs.readdirSync(pluginPath)
  const extensions = {}

  jobData.coinbase1 = coinbase1
  jobData.coinbase2 = coinbase2

  // run each extension plugin in order to add data to the extensions object
  // if the data needed for that extension is provided in jobData
  pluginFiles.forEach(pluginFile => {
    const pluginFilePath = path.join(__dirname, '../', pluginPath, pluginFile)
    require(pluginFilePath)({ extensions, jobData })
  })

  if (extensions !== {}) {
    doc.extensions = extensions
  }
}

module.exports = addExtensions
