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
      description: 'generateminerid, rotateminerid, rotaterevocationkey, revokemineridpartially, revokemineridcompletely, upgrademinerid, config'
    },
    {
      name: 'help',
      alias: 'h',
      type: Boolean,
      description: 'Display this usage guide.'
    },
    {
      name: 'minerid',
      alias: 'm',
      type: String,
      description: 'The compromised minerId public key to be revoked.'
    },
    {
      name: 'firstminerid',
      alias: 'f',
      type: String,
      description: 'The first minerId public key used in the first Miner ID reputation chain.'
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
      content: 'Generate/rotate/revoke a minerId or get a signed miner info document for a minerId. Rotate a revocationKey key.'
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
          desc: 'Add minerContact data',
          example: 'npm run cli -- config email=s@aliasDomain.com -n [alias]'
        },
        {
          desc: 'Generate op_return with signed miner-info document',
          example: 'npm run cli -- --height 5123123 --name [alias]'
        },
        {
          desc: 'Rotate minerId',
          example: 'npm run cli -- rotateminerid --name [alias]'
        },
        {
          desc: 'Rotate revocationKey',
          example: 'npm run cli -- rotaterevocationkey --name [alias]'
        },
        {
          desc: 'Partial minerId revocation',
          example: 'npm run cli -- revokemineridpartially --minerid [minerId] --name [alias]'
        },
        {
          desc: 'Complete minerId revocation',
          example: 'npm run cli -- revokemineridcompletely --name [alias]'
        },
        {
          desc: 'Upgrade minerId v0.1/v0.2 protocol data to v0.3',
          example: 'npm run cli -- upgrademinerid --firstminerid [minerId] --name [alias]'
        }
      ]
    }
  ])

  function createReusableRevocationKeyData(aliasName) {
     fm.writeRevocationKeyDataToFile(options.name)
     console.log(`\nReusable revocation key data were stored in the config file for "${aliasName}" alias.`)
  }

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
    try {
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
	  case 'generateminerid': {
	    if (coinbaseDocService.generateMinerId(options.name)) {
	      createReusableRevocationKeyData(options.name)
	      console.log('MinerId generation has succeeded.')
	    } else {
	      console.log('MinerId generation has failed!')
	    }
	    break
	  }
	  case 'rotateminerid': {
	    if (coinbaseDocService.rotateMinerId(options.name)) {
	      console.log('minerId key rotation has succeeded.')
	    } else {
	      console.log('minerId key rotation has failed!')
	    }
	    break
	  }
	  case 'rotaterevocationkey': {
	    if (coinbaseDocService.rotateRevocationKey(options.name)) {
	      createReusableRevocationKeyData(options.name)
	      console.log('Revocation key rotation has succeeded.')
	    } else {
	      console.log('Revocation key rotation has failed!')
	    }
	    break
	  }
	  case 'revokemineridpartially': {
            if (!options.minerid) {
              console.log('Error: Specify the minerId public key to be revoked!')
              console.log('Use: --minerid [minerId]')
              process.exit(0)
	    }
            if (coinbaseDocService.revokeMinerId(options.name, options.minerid, false /* partial revocation */)) {
              console.log("Revocation data has been created for the compromised minerId key.")
	    } else {
              console.log("MinerId partial revocation has failed!")
	    }
	    break
	  }
	  case 'revokemineridcompletely': {
            const minerIdData = fm.readMinerIdDataFromFile(options.name)
            if (!minerIdData.hasOwnProperty('first_minerId')) {
              console.log('Cannot find "first_minerId" in the config file.')
              break
	    }
            if (coinbaseDocService.revokeMinerId(options.name, minerIdData["first_minerId"], true /* complete revocation */)) {
              console.log("Revocation data has been created for the compromised minerId key.")
	    }
	    break
	  }
	  case 'upgrademinerid': {
	    if (coinbaseDocService.canUpgradeMinerIdProtocol(options.name)) {
	      if (!options.firstminerid) {
	        console.log('Error: Specify the first minerId public key!')
	        console.log('Use: --firstminerid [minerId]')
	        process.exit(0)
	      }
	      const alias = options.name + '_1'
	      let firstMinerId = {}
	      firstMinerId["first_minerId"] = options.firstminerid
	      fm.writeMinerIdDataToFile(options.name, firstMinerId)
	      fm.createRevocationKey(alias)
	      fm.saveRevocationKeyAlias(options.name, alias)
	      createReusableRevocationKeyData(options.name)
	      console.log('Miner ID protocol upgrade has succeeded.')
	    } else {
	      console.log('Miner ID protocol upgrade has failed!')
	    }
	    break
	  }
	  default: {
	    console.log(`Unknown command: ${options.command}`)
	    console.log(usage)
	    break
	  }
	}
    } catch (e) {
      console.log(e)
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
