function addFeeSpec ({ extensions = {}, jobData = {} }) {
  if (jobData.feeSpec) {
    extensions.defaultFee = jobData.feeSpec
  }
}

module.exports = addFeeSpec
