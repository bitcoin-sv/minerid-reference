module.exports = function getPadding (cb1) {
  const initial = 4 + 1 + 32 + 4

  if (cb1.length < initial) {
    throw new Error('Coinbase1 is too short')
  }

  cb1 = cb1.slice(initial)

  let size = cb1.readUInt8(0)
  cb1 = cb1.slice(1)
  switch (true) {
    case size < 0xfd:
      break
    case size === 0xfd:
      size = cb1.readUInt16LE(0)
      cb1 = cb1.slice(2)
      break
    case size === 0xfe:
      size = cb1.readUInt32LE(0)
      cb1 = cb1.slice(4)
      break
  }
  return Buffer.alloc(size - cb1.length)
}
