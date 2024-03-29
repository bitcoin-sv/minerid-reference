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
      description: 'generateminerid, getcurrentminerid, rotateminerid, rotaterevocationkey, revokemineridpartially, revokemineridcompletely, upgrademinerid, config'
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
      description: 'The block height that will be included in the miner-info document.'
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
      content: 'Generate/rotate/revoke a minerId or get a signed miner-info document for a minerId. Rotate a revocationKey key.'
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
          desc: 'Get the current minerId',
          example: 'npm run cli -- getcurrentminerid --name [alias]'
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

  let options
  try {
    options = commandLineArgs(optionDefinitions)
  } catch (e) {
    console.error('Unknown argument')
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
        const confirmationMsg = "Wait for a new miner ID block(s) to confirm this operation on the blockchain."
        const blocksNumberMsg = "The expected number of miner ID blocks to be mined is:"
        const blocksNumberMsg_1 = blocksNumberMsg + " 1."
        const blocksNumberMsg_2 = blocksNumberMsg + " 2."

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
	      console.log(`Miner ID generation has succeeded. ${confirmationMsg} ${blocksNumberMsg_1}`)
	    } else {
	      console.error('Miner ID generation has failed!')
	    }
	    break
	  }
	  case 'getcurrentminerid': {
	    if (!fm.aliasExists(options.name)) {
	      console.error(`The given "${options.name}" alias doesn't exist.`)
	    } else {
	      const currentMinerId = coinbaseDocService.getCurrentMinerId(options.name)
	      if (currentMinerId) {
	        console.log(`The current minerId public key is: ${currentMinerId}. Check if the key is confirmed on the blockchain.`)
	      } else {
	        console.error('Error: Check if the minerId private key is in the keystore!')
	      }
	    }
	    break
	  }
	  case 'rotateminerid': {
	    if (coinbaseDocService.rotateMinerId(options.name)) {
	      console.log(`Miner ID key rotation has succeeded. ${confirmationMsg} ${blocksNumberMsg_2}`)
	    } else {
	      console.error('Miner ID key rotation has failed!')
	    }
	    break
	  }
	  case 'rotaterevocationkey': {
	    if (coinbaseDocService.rotateRevocationKey(options.name)) {
	      console.log(`Revocation key rotation has succeeded. ${confirmationMsg} ${blocksNumberMsg_2}`)
	    } else {
	      console.error('Revocation key rotation has failed!')
	    }
	    break
	  }
	  case 'revokemineridpartially': {
            if (!options.minerid) {
              console.error('Error: Specify the minerId public key to be revoked!')
              console.log('Use: --minerid [minerId]')
              process.exit(0)
	    }
            if (await coinbaseDocService.revokeMinerId(options.name, options.minerid, false /* partial revocation */)) {
              console.log(`Revocation data has been created for the compromised minerId key. ${confirmationMsg} ${blocksNumberMsg_2}`)
	    } else {
              console.error('Miner ID partial revocation has failed!')
	    }
	    break
	  }
	  case 'revokemineridcompletely': {
            const minerIdData = fm.readMinerIdDataFromFile(options.name)
            if (!minerIdData.hasOwnProperty('first_minerId')) {
              console.error('Cannot find "first_minerId" in the config file.')
              break
	    }
            if (await coinbaseDocService.revokeMinerId(options.name, minerIdData["first_minerId"], true /* complete revocation */)) {
              console.log(`Revocation data has been created for the compromised minerId key. ${confirmationMsg} ${blocksNumberMsg_1}`)
	    }
	    break
	  }
	  case 'upgrademinerid': {
	    if (coinbaseDocService.canUpgradeMinerIdProtocol(options.name)) {
	      if (!options.firstminerid) {
	        console.error('Error: Specify the first minerId public key!')
	        console.log('Use: --firstminerid [minerId]')
	        process.exit(0)
	      }
	      const alias = options.name + '_1'
	      let firstMinerId = {}
	      firstMinerId["first_minerId"] = options.firstminerid
	      fm.writeMinerIdDataToFile(options.name, firstMinerId)
	      fm.createRevocationKey(alias)
	      fm.saveRevocationKeyAlias(options.name, alias)
	      fm.writeRevocationKeyDataToFile(options.name, false)
	      fm.writeOpReturnStatusToFile(options.name, true)
	      console.log(`Miner ID protocol upgrade has succeeded. ${confirmationMsg} ${blocksNumberMsg_1}`)
	    } else {
	      console.error('Miner ID protocol upgrade has failed!')
	    }
	    break
	  }
	  default: {
	    console.error(`Unknown command: ${options.command}`)
	    console.log(usage)
	    break
	  }
	}
    } catch (e) {
      console.log(e)
    }
    process.exit(0)
  } else if (!options.height) {
    console.error('You must specify a height')
    console.log('--height [heightNumber]')
    console.log('-h [heightNumber]')
    process.exit(0)
  }

  const opReturn = await coinbaseDocService.createMinerInfoOpReturn(options.name, options.height)
  if (opReturn) {
    console.log('OP_RETURN hex:')
    console.log(opReturn)
  }
})()
