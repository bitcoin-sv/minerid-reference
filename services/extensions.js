const fs = require('fs')
const path = require('path')

const pluginPath = 'plugins'

function addExtensions (extensions, extensionData) {
  if (!extensions) {
    extensions = {}
  }
  const pluginFiles = fs.readdirSync(pluginPath)

  pluginFiles.forEach(pluginFile => {
    const pluginName = pluginFile.split('.')[0]
    const pluginFilePath = path.join(__dirname, '../', pluginPath, pluginFile)

    const plugin = require(pluginFilePath)
    const pluginData = plugin(extensionData)

    if (pluginData) {
      extensions[pluginName] = pluginData
    }
  })

  return extensions
}

module.exports = addExtensions
