const express = require('express')
const bodyParser = require('body-parser')
const config = require('config')
const fm = require('./utils/filemanager')
const { placeholderCB1 } = require('./utils/minerinfo')
const coinbaseDocService = require('./services/coinbaseDocumentService')
const { authenticateToken } = require('./utils/authentication')
const bsv = require('bsv')

require('log-timestamp')

const app = express()
app.use(bodyParser.json())

if (!config.hasOwnProperty('debug') || !config.get('debug')) {
  console.debug = function () {};
} else {
  console.log('Debug print enabled ')
}

app.get('/datarefs/:alias/opreturns', authenticateToken, async (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  const { alias } = req.params

  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(alias)) {
    res.status(422).send(`Alias "${alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', alias)
    return
  }

  try {
    const opReturn = await coinbaseDocService.createDataRefsOpReturns(alias)
    res.send(opReturn)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
}
)

app.get('/opreturn/:alias/:blockHeight([0-9]+)', authenticateToken, async (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  const { blockHeight, alias } = req.params

  res.setHeader('Content-Type', 'text/plain')

  if (blockHeight < 1) {
    res.status(422).send('Must enter a valid height')
    console.error('Bad request: invalid height: ', blockHeight)
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(422).send(`Alias "${alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', alias)
    return
  }

  try {
    const opReturn = await coinbaseDocService.createMinerInfoOpReturn(
      alias,
      blockHeight
    )
    res.send(opReturn)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
}
)

app.get('/opreturn/:alias/:blockHeight([0-9]+)/:dataRefsTxId', authenticateToken, async (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  const { dataRefsTxId, blockHeight, alias } = req.params

  res.setHeader('Content-Type', 'text/plain')

  if (!/^[A-F0-9]{64}$/i.test(dataRefsTxId)) {
    res.status(422).send('dataRef txid must be a 64-characters hexadecimal string')
    console.error('Bad request: invalid dataRefs txid: ', dataRefsTxId)
    return
  }

  if (blockHeight < 1) {
    res.status(422).send('Must enter a valid height')
    console.error('Bad request: invalid height: ', blockHeight)
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(422).send(`Alias "${alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', alias)
    return
  }

  try {
    const opReturn = await coinbaseDocService.createMinerInfoOpReturn(
      alias,
      blockHeight,
      dataRefsTxId
    )
    res.send(opReturn)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
}
)

app.post('/coinbase2', authenticateToken, async (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  const { alias, minerInfoTxId, prevhash, merkleProof, coinbase2 } = req.body

  res.setHeader('Content-Type', 'text/plain')

  if (!alias) {
    res.status(400).send('Alias must be supplied')
    console.error('Bad request: no alias supplied')
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(422).send(`Alias "${alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', alias)
    return
  }

  if (!minerInfoTxId) {
    res.status(400).send('Miner-info txid must be supplied')
    console.error('Bad request: no miner-info txid supplied')
    return
  }

  if (!/^[A-F0-9]{64}$/i.test(minerInfoTxId)) {
    res.status(422).send('Miner-info txid must be a 64-characters hexadecimal string')
    console.error('Bad request: invalid miner-info txid: ', minerInfoTxId)
    return
  }

  if (!prevhash) {
    res.status(400).send('prevhash must be supplied')
    console.error('Bad request: no prevhash supplied')
    return
  }

  if (!/^[A-F0-9]{64}$/i.test(prevhash)) {
    res.status(422).send('prevhash must be a 64-characters hexadecimal string')
    console.error('Bad request: invalid prevhash: ', prevhash)
    return
  }

  if (!coinbase2) {
    res.status(400).send('Coinbase 2 must be supplied')
    console.error('Bad request: no coinbase2 supplied')
    return
  }

  try {
    // try to create a BitCoin transaction using Coinbase 2
    bsv.Transaction(
      Buffer.concat([
        Buffer.from(placeholderCB1, 'hex'),
        Buffer.from(coinbase2, 'hex')
      ])
    )
  } catch (error) {
    res.status(422).send('Invalid Coinbase 2')
    console.error('Bad request: invalid coinbase2: ', coinbase2)
    return
  }

  try {
    const cb2 = await coinbaseDocService.createNewCoinbase2(
      alias,
      minerInfoTxId,
      prevhash,
      merkleProof,
      coinbase2
    )
    res.send(cb2)
  } catch (err) {
    res.status(500).send(`Internal error:: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
})

app.get('/opreturn/:alias/rotate', authenticateToken, (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  try {
    coinbaseDocService.rotateMinerId(req.params.alias)
    res.send('OK')
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
})

app.get('/opreturn/:alias/isvalid', authenticateToken, (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  try {
    res.send(coinbaseDocService.opReturnStatus(req.params.alias))
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
})

app.get('/minerid/:alias', authenticateToken, (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  try {
    const currentAlias = coinbaseDocService.getCurrentMinerId(req.params.alias)
    res.send(currentAlias)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
})

app.get('/minerid/:alias/sign/:hash([0-9a-fA-F]+)', authenticateToken, (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  if (req.params.hash.length !== 64) {
    res.status(422).send('Hash must be 64 characters (32 byte hex string)')
    console.error('Bad request: invalid hash: ', req.params.hash)
    return
  }

  try {
    const signature = coinbaseDocService.signWithCurrentMinerId(
      req.params.hash,
      req.params.alias
    )
    res.send(signature)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
}
)

app.get('/minerid/:alias/pksign/:hash([0-9a-fA-F]+)', authenticateToken, (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`)
  res.setHeader('Content-Type', 'application/json')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.error('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  if (req.params.hash.length !== 64) {
    res.status(422).send('Hash must be 64 characters (32 byte hex string)')
    console.error('Bad request: invalid hash: ', req.params.hash)
    return
  }

  try {
    const currentAlias = coinbaseDocService.getCurrentMinerId(
      req.params.alias
    )
    const signature = coinbaseDocService.signWithCurrentMinerId(
      req.params.hash,
      req.params.alias
    )

    res.send({ publicKey: currentAlias, signature })
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.error(`Internal error: ${err.message}`)
  }
}
)

app.listen(config.get('port'), () => {
  console.log(`Server running on port ${config.get('port')}`)
})
