const express = require('express')
const config = require('./config.json')
const fm = require('./utils/filemanager')

const coinbaseDocService = require('./services/coinbaseDocumentService')

const app = express()

app.get('/opreturn/:alias/:blockHeight([0-9]+)', async (req, res) => {
  res.setHeader('Content-Type', 'text/plain')

  if (!fm.aliasExists(req.params.alias)) {
    res.status(400).send(`Alias "${req.params.alias}" doesn't exist`)
    return
  }

  try {
    const opReturn = await coinbaseDocService.createMinerIdOpReturn(req.params.blockHeight, req.params.alias)
    res.send(opReturn)
  } catch (err) {
    res.status(500).send(`Internal error ${err.message}`)
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
