// Distributed under the Open BSV software license, see the accompanying file LICENSE.

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
