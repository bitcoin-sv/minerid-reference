#!/usr/bin/env node
const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')
const config = require('config')
const network = config.get('network')

const coinbaseDocService = require('./services/coinbaseDocumentService')
const fm = require('./utils/filemanager')

  ; (async () => {
  const optionDefinitions = [
    {
      name: 'command',
      type: String,
      defaultOption: true,
      multiple: true,
      description: 'generateminerid, generatevctx, rotateminerid, config'
    },
    {
      name: 'help',
      alias: 'h',
      type: Boolean,
      description: 'Display this usage guide.'
    },
    {
      name: 'height',
      alias: 't',
      type: Number,
      description: 'The block height that will be included in the coinbase document.'
    },
    {
      name: 'name',
      alias: 'n',
      type: String,
      description: 'The name associated with the minerId.'
    }

  ]

  const usage = commandLineUsage([
    {
      header: 'Miner Id Client',
      content: 'Generate a minerId or get a signed coinbase document for a minerId.'
    },
    {
      header: 'Options',
      optionList: optionDefinitions
    },
    {
      header: 'Examples',
      content: [
        {
          desc: 'Generate a minerId',
          example: 'npm run cli -- generateminerid --name [alias]'
        },
        {
          desc: 'Generate VCTx',
          example: 'npm run cli -- generatevctx -n [alias]'
        },
        {
          desc: 'Add minerContact data',
          example: 'npm run cli -- config email=s@aliasDomain.com -n [alias]'
        },
        {
          desc: 'Generate op_return with signed coinbase document',
          example: 'npm run cli -- --height 5123123 --name [alias]'
        },
        {
          desc: 'Rotate minerId',
          example: 'npm run cli -- rotateminerid --name [alias]'
        }
      ]
    }
  ])

  let options
  try {
    options = commandLineArgs(optionDefinitions)
  } catch (e) {
    console.log('Unknown argument')
    console.log(usage)
    process.exit(0)
  }
  if (options.help || (!options.name && !options.height)) {
    console.log(usage)
    process.exit(0)
  }
  if (!options.name) {
    console.log('You must specify a name:')
    console.log('--name [name]')
    console.log('-n [name]')
    process.exit(0)
  }
  switch (network) {
    case 'livenet':
      console.log('--- MAIN NETWORK ---')
      break

    case 'testnet':
      console.log('--- TEST NETWORK ---')
      break

    case 'regtest':
      console.log('--- REGTEST ---')
      break

    default:
      console.log('Network cofiguration not properly set in config.json file')
      break
  }
  if (options.command) {
    switch (options.command[0].toLowerCase()) {
      case 'config': {
        if (options.command.length < 2 || options.command[1].indexOf('=') === -1) {
          console.log(fm.getMinerContactData(options.name))
          break
        }
        const nvp = options.command[1].split('=')
        fm.updateMinerContactData(options.name, nvp[0], nvp[1])
        break
      }
      case 'generateminerid':
        if (coinbaseDocService.generateMinerId(options.name)) {
          fm.writeRevocationKeyDataToFile(options.name)
	}
        break
      case 'generatevctx':
        await coinbaseDocService.generateVcTx(options.name)
        break
      case 'rotateminerid':
        coinbaseDocService.rotateMinerId(options.name)
        console.log('Rotated minerId')
        break
      default:
        console.log(`Unknown command: ${options.command}`)
        console.log(usage)
        break
    }
    process.exit(0)
  } else if (!options.height) {
    console.log('You must specify a height')
    console.log('--height [heightNumber]')
    console.log('-h [heightNumber]')
    process.exit(0)
  }

  const opReturn = await coinbaseDocService.createMinerInfoOpReturn(options.height, options.name)
  if (opReturn) {
    console.log('OP_RETURN hex:')
    console.log(opReturn)
  }
})()
