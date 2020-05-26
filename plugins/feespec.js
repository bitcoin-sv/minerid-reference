function addFeeSpec ({ extensions = {}, extensionData = {} }) {
  if (extensionData.feeSpec) {
    extensions.defaultFee = extensionData.feeSpec
  }
}

module.exports = addFeeSpec
