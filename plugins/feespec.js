function addFeeSpec ({ extensions = {}, jobData = {} }) {
  if (jobData.feeSpec) {
    extensions.feeSpec = jobData.feeSpec
  }
}

module.exports = addFeeSpec
