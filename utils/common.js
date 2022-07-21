/**
 * Hex-based concatenation of two fields.
 */
function concatFields(l, r) {
  return Buffer.concat([
    Buffer.from(l, 'hex'),
    Buffer.from(r, 'hex')
  ])
}

module.exports = {
  concatFields
}
