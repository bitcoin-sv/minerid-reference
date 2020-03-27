# MinerId Builder - Reference Implementation

More details available in the [BRFC Spec](https://bitbucket.org/nchteamnch/minerid/src/master/) for MinerId.  


## Configuration

[config.json](config.json) options:  

- change port
- change minerIdDataPath which stores user's minerids  
- change keystore which stores minerId private keys  
- change network (mainnet="livenet" | testnet="testnet" | regtest="regtest")  
- change Bitcoin RPC parameters

## Installation

```console
$ npm install
```

To run API server:
```
$ npm start
```

To run CLI:
```
$ npm run cli
```

## CLI

### Options

  `--command string[]    generatevctx, rotateid, config`

  `-h, --help            Display this usage guide.`

  `-t, --height number   The block height that will be included in the coinbase document.`

  `-n, --name string     The alias for the minerId. This shouldn't change while the minerId may be changed by rotating it.`


### Examples

  Generate a new minerId. This will generate a minerId and associate it with the alias name

  `npm run cli -- generateminerid --name foo`  
  or  
  `npm run cli -- generateminerid -n foo`
  
  Generate a Validity Check Transaction (VCTX).  
  
  `npm run cli -- generatevctx --name foo`

  Generate op_return with signed coinbase document.  
  
  `npm run cli -- --height 5123123 --name foo`

  Rotate a minerId. This command rotates the minerId which generates a new one. This is done by spending the current VCTX to create a new VCTX with the new minerId in op_return. Subsequent coinbase documents will contain references to both minerIds
  
  `npm run cli -- rotateminerid --name foo`

  Add a key value pair to the config file. This will be used to fill the `minerContact` object. You can add any key value pairs here but you should add one called `name` as this can then be used to identify you. Obviously this doesn't have to be your real name but should be something you're happy to share with the world.
  
  `npm run cli -- config email=sami@foo.com -n foo`  
  or  
  `npm run cli -- config website=foo.com -n foo`

## API

## Implementation

The **REST API** has 4 endpoints:

### 1. `GET /opreturn/:alias/:blockHeight([0-9]+)`

`alias`: MinerId alias  
`blockHeight`: block height which MinerId document is created for/at

**returns** MinerId output (locking) script hex string for an `alias` MinerId at height `blockHeight`

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/1234

006a04ac1eed884de1017b2276657273696f6e223a22302e31222c22686569676874223a313233342c22707265764d696e65724964223a22303364383139363262316561373964306530366438653166363661323661363064346561636463323430373236326332393130633537303963613937613637623864222c22707265764d696e65724964536967223a223330343430323230313131636338383437663638636334636333346335363863376533396635333965663161663832616563613765376565633766646330653230663439393938623032323031653232376437656334623163643138626637656631323463303661653135376232623136363835313934303536623834633836616563333961643731663139222c226d696e65724964223a22303364383139363262316561373964306530366438653166363661323661363064346561636463323430373236326332393130633537303963613937613637623864222c2276637478223a7b2274784964223a2236653631363431643034613463336337353164363536663938666238343533383738376565343335393830626432323865616163386534663364646162643033222c22766f7574223a307d2c226d696e6572436f6e74616374223a7b226e616d65223a22746573744d696e6572227d7d4630440220509d60519d1508045b4629bfb748fc6d9c7e240bc6cea49d5ec084c818005e2c022069ebd520bf65b75b9bd579b7ae09559efe2b6857e64cc47ae6700aa2e6e8132e
```

### 2. `GET /opreturn/:alias/rotate`

`alias`: MinerId alias  

rotates the MinerId key for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/rotate

OK
```

### 3. `GET /minerid/:alias`

`alias`: MinerId alias  

**returns** compressed public key (33 byte) hex string for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/minerid/testMiner

02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc6326a
```


### 4. `GET /minerid/:alias/sign/:hash`

`alias`: MinerId alias  
`hash`: SHA256 hash (32 byte hex string) to be fed to ECDSA signing agorithm


**returns** hash signature (71-73 byte hex string) using an `alias` MinerId

#### Example

```console
$ curl localhost:9002/minerid/testMiner/sign/02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc632

3045022100e0f86a5b1748ae48b0d10ea305202769d754071272cba0fbb82f74f8e8da8b530220494351742f3ba9e51b155df15b13f27c927d21956822aedcbb7d179c66d4d4c0
```


## Example Miner Code

[testMiner.js](testMiner.js) contains basic code needed to generate a coinbase transaction that has a MinerId (ouput) in it by calling the first API [endpoint](#1-get-opreturnaliasblockheight0-9) and then adding that ouput to it's coinbase transaction.  

1. Generate MinerId  
   ` npm run cli -- generateminerid -n testMiner`
   
2. Generate VcTx (not needed for Regtest)  
   `npm run cli -- generatevctx -n testMiner`

3. Create coinbase transaction  
   `node examples/testMiner.js`