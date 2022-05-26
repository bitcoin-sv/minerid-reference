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
  placeholderCB1
}
