const fs = require('fs')
const path = require('path')

const pluginPath = 'plugins'

function addExtensions (extensionData) {
  if (!extensionData) {
    extensionData = {}
  }

  const pluginFiles = fs.readdirSync(pluginPath)
  const extensions = {}

  // run each extension plugin in order to add data to the extensions object
  // if the data needed for that extension is provided in extensionData
  pluginFiles.forEach(pluginFile => {
    const pluginFilePath = path.join(__dirname, '../', pluginPath, pluginFile)
    require(pluginFilePath)({ extensions, extensionData })
  })

  return extensions
}

module.exports = addExtensions
