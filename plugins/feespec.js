function addFeeSpec (extensionData) {
  if (!extensionData || !extensionData.hasOwnProperty('feeSpec')) {
    return
  }

  if (extensionData.feeSpec.defaultFee) {
    return {
      defaultFee: extensionData.feeSpec.defaultFee
    }
  }
  if (extensionData.feeSpec.fees) { // mAPI returns 'fees' instead of 'defaultFee'
    return {
      defaultFee: extensionData.feeSpec.fees
    }
  }
}

module.exports = addFeeSpec
