const bsv = require('bsv')
const rp = require('request-promise')

async function getMinerIdOutputScript (height) {
  const requestOptions = {
    method: 'GET',
    uri: `http://localhost:9002/opreturn/testMiner/${height}`,
    resolveWithFullResponse: true
  }

  const res = await rp(requestOptions)

  if (res.statusCode === 200) {
    return res.body
  } else {
    throw new Error(`Status code: ${res.statusCode}`)
  }
}

; (async () => {
  // Create a random private key and address...
  const privateKey = new bsv.PrivateKey.fromRandom()
  const publicKey = new bsv.PublicKey.fromPrivateKey(privateKey)
  const address = new bsv.Address.fromPublicKey(publicKey)

  // Create a standard coinbase TX
  const coinbaseInput = new bsv.Transaction.Input({
    prevTxId: '0000000000000000000000000000000000000000000000000000000000000000',
    outputIndex: 0xFFFFFFFF,
    script: new bsv.Script()
  })

  const tx = new bsv.Transaction()
    .uncheckedAddInput(coinbaseInput)
    .to(address, 1250000000)

  // Now get MinerId output and add to our tx...
  try {
    const blockHeight = 1234

    const minerIdOutputScript = await getMinerIdOutputScript(blockHeight)

    const minerIdOutput = new bsv.Transaction.Output({
      satoshis: 0,
      script: new bsv.Script(minerIdOutputScript)
    })

    console.log(`\nCoinbase document for height ${blockHeight}:\n`)
    console.log(JSON.parse(Buffer.from(minerIdOutput.script.toASM().split(' ')[3], 'hex').toString()))

    tx.addOutput(minerIdOutput)
  } catch (error) {
    console.log(error.message)
  }

  console.log('\nRAW Coinbase transaction:\n')
  console.log(tx.toString())
})()
