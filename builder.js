const express = require('express')
const bodyParser = require('body-parser')
const config = require('config')
const fm = require('./utils/filemanager')
const { placeholderCB1 } = require('./services/extensions')
const coinbaseDocService = require('./services/coinbaseDocumentService')
const bsv = require('bsv')

const app = express()
app.use(bodyParser.json())

app.get('/opreturn/:alias/:blockHeight([0-9]+)', async (req, res) => {
  const { blockHeight, alias } = req.params

  res.setHeader('Content-Type', 'text/plain')

  if (blockHeight < 1) {
    res.status(422).send('Must enter a valid height')
    console.log('Bad request: invalid height: ', blockHeight)
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(422).send(`Alias "${alias}" doesn't exist`)
    console.log('Bad request: non-existent alias: ', alias)
    return
  }

  try {
    const opReturn = await coinbaseDocService.createMinerIdOpReturn(blockHeight, alias)
    res.send(opReturn)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.warn(`Internal error: ${err.message}`)
  }
})

app.post('/coinbase2', async (req, res) => {
  const { blockHeight, alias, coinbase2, jobData } = req.body

  res.setHeader('Content-Type', 'text/plain')

  if (!blockHeight) {
    res.status(400).send('Block height must be supplied')
    console.log('Bad request: no height supplied')
    return
  }

  if (blockHeight < 1) {
    res.status(422).send('Block height must be positive')
    console.log('Bad request: invalid height: ', blockHeight)
    return
  }

  if (!alias) {
    res.status(400).send('Alias must be supplied')
    console.log('Bad request: no alias supplied')
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(422).send(`Alias "${alias}" doesn't exist`)
    console.log('Bad request: non-existent alias: ', alias)
    return
  }

  if (!coinbase2) {
    res.status(400).send('Coinbase 2 must be supplied')
    console.log('Bad request: no coinbase2 supplied')
    return
  }

  try {
    // try to create a BitCoin transaction using Coinbase 2
    bsv.Transaction(Buffer.concat([Buffer.from(placeholderCB1, 'hex'), Buffer.from(coinbase2, 'hex')]))
  } catch (error) {
    res.status(422).send('Invalid Coinbase 2')
    console.log('Bad request: invalid coinbase2: ', coinbase2)
    return
  }

  try {
    const cb2 = await coinbaseDocService.createNewCoinbase2(blockHeight, alias, coinbase2, jobData)
    res.send(cb2)
  } catch (err) {
    res.status(500).send(`Internal error:: ${err.message}`)
    console.warn(`Internal error: ${err.message}`)
  }
})

app.get('/opreturn/:alias/rotate', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.log('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  try {
    coinbaseDocService.rotateMinerId(req.params.alias)
    res.send('OK')
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.warn(`Internal error: ${err.message}`)
  }
})

app.get('/minerid/:alias', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.log('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  try {
    const currentAlias = coinbaseDocService.getCurrentMinerId(req.params.alias)
    res.send(currentAlias)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.warn(`Internal error: ${err.message}`)
  }
})

app.get('/minerid/:alias/sign/:hash([0-9a-fA-F]+)', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.log('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  if (req.params.hash.length !== 64) {
    res.status(422).send('Hash must be 64 characters (32 byte hex string)')
    console.log('Bad request: invalid hash: ', req.params.hash)
    return
  }

  try {
    const signature = coinbaseDocService.signWithCurrentMinerId(req.params.hash, req.params.alias)
    res.send(signature)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.warn(`Internal error: ${err.message}`)
  }
})

app.get('/minerid/:alias/pksign/:hash([0-9a-fA-F]+)', (req, res) => {
  res.setHeader('Content-Type', 'application/json')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(422).send(`Alias "${req.params.alias}" doesn't exist`)
    console.log('Bad request: non-existent alias: ', req.params.alias)
    return
  }

  if (req.params.hash.length !== 64) {
    res.status(422).send('Hash must be 64 characters (32 byte hex string)')
    console.log('Bad request: invalid hash: ', req.params.hash)
    return
  }

  try {
    const currentAlias = coinbaseDocService.getCurrentMinerId(req.params.alias)
    const signature = coinbaseDocService.signWithCurrentMinerId(req.params.hash, req.params.alias)

    res.send({ publicKey: currentAlias, signature })
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
    console.warn(`Internal error: ${err.message}`)
  }
})

app.listen(config.get('port'), () => {
  console.log(`Server running on port ${config.get('port')}`)
})
