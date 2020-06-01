const express = require('express')
const bodyParser = require('body-parser')
const config = require('./config.json')
const fm = require('./utils/filemanager')

const coinbaseDocService = require('./services/coinbaseDocumentService')

const app = express()
app.use(bodyParser.json())

app.get('/opreturn/:alias/:blockHeight([0-9]+)', async (req, res) => {
  const { blockHeight, alias } = req.params

  res.setHeader('Content-Type', 'text/plain')

  if (blockHeight < 1) {
    res.status(400).send('Must enter a valid height')
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(400).send(`Alias "${alias}" doesn't exist`)
    return
  }

  try {
    const opReturn = await coinbaseDocService.createMinerIdOpReturn(blockHeight, alias)
    res.send(opReturn)
  } catch (err) {
    res.status(500).send(`Internal error ${err.message}`)
  }
})

app.post('/coinbase2', async (req, res) => {
  const { blockHeight, alias, coinbase1, coinbase2, jobData } = req.body

  res.setHeader('Content-Type', 'text/plain')

  if (!blockHeight) {
    res.status(400).send(`blockHeight must be supplied`)
    return
  }

  if (blockHeight < 1) {
    res.status(400).send('blockHeight must be positive')
    return
  }

  if (!alias) {
    res.status(400).send(`Alias must be supplied`)
    return
  }

  if (!fm.aliasExists(alias)) {
    res.status(400).send(`Alias "${alias}" doesn't exist`)
    return
  }

  if (!coinbase1) {
    res.status(400).send('Coinbase 1 must be supplied')
    return
  }

  if (!coinbase2) {
    res.status(400).send('Coinbase 2 must be supplied')
    return
  }

  try {
    const cb2 = await coinbaseDocService.createCoinbase2(blockHeight, alias, coinbase1, coinbase2, jobData)
    res.send(cb2)
  } catch (err) {
    res.status(500).send(`Internal error: ${err.message}`)
  }
})

app.get('/opreturn/:alias/rotate', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(400).send(`Alias "${req.params.alias}" doesn't exist`)
    return
  }

  try {
    coinbaseDocService.rotateMinerId(req.params.alias)
    res.send('OK')
  } catch (err) {
    res.status(500).send(`Internal error ${err.message}`)
  }
})

app.get('/minerid/:alias', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(400).send(`Alias "${req.params.alias}" doesn't exist`)
    return
  }

  try {
    const currentAlias = coinbaseDocService.getCurrentMinerId(req.params.alias)
    res.send(currentAlias)
  } catch (err) {
    res.status(500).send(`Internal error ${err.message}`)
  }
})

app.get('/minerid/:alias/sign/:hash([0-9a-fA-F]+)', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(400).send(`Alias "${req.params.alias}" doesn't exist`)
    return
  }

  if (req.params.hash.length !== 64) {
    res.status(400).send('Hash must be 64 characters (32 byte hex string)')
    return
  }

  try {
    const signature = coinbaseDocService.signWithCurrentMinerId(req.params.hash, req.params.alias)
    res.send(signature)
  } catch (err) {
    res.status(500).send(`Internal error ${err.message}`)
  }
})

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`)
})
