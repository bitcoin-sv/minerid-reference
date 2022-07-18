# Miner ID Generator - Reference Implementation

More details available in the [BRFC Spec](https://github.com/bitcoin-sv-specs/brfc-minerid) for MinerId.  


## Table of Contents
- [Requirements](#requirements)
  - [Node](#node)
- [Install](#install)
- [Configuration](#configuration)
- [Running the project](#running-the-project)
- [Testing](#testing)
- [CLI](#cli)
  - [Options](#options)
  - [Examples](#examples)
- [API](#api)
- [Implementation](#implementation)
- [Example Miner Code](#example-miner-code)

## Support

For support and general discussion of both standards and reference implementations please join the following [telegram group](https://t.me/joinchat/JB6ZzktqwaiJX_5lzQpQIA).

## Requirements

For development, you will only need Node.js (minimum 10.12.0) and a node global package, NPM, installed in your environment.

### Node

- #### Node installation on Windows

  Just go on [official Node.js website](https://nodejs.org/) and download the installer.
Also, be sure to have `git` available in your PATH, `npm` might need it (You can find git [here](https://git-scm.com/)).

- #### Node installation on Ubuntu

  You can install nodejs and npm easily with apt install, just run the following commands.

    ```console
    $ sudo apt install nodejs
    $ sudo apt install npm
    ```

- #### Other Operating Systems
  You can find more information about the installation on the [official Node.js website](https://nodejs.org/) and the [official NPM website](https://npmjs.org/).

## Install

```console
$ git clone https://github.com/bitcoin-sv/minerid-reference.git
$ cd minerid-reference
$ npm install
```

## Configuration

Open [config/default.json](config/default.json) and edit it with your settings:  

- change (or leave) the default `port`
- set `debug=true` to enable debug logging
- change (or leave) the default `minerIdDataPath` config which points to the user's minerIds location (interpreted as `~/${minerIdDataPath}`)
- change (or leave) the default `keystorePath` config which points to the minerId private keys keystore (interpreted as `~/${keystorePath}`)
- change (or leave) the default `revocationKeystorePath` config which points to the revocation private keys keystore (interpreted as `~/${revocationKeystorePath}`)
- change the default `network` (mainnet="livenet" | testnet="testnet" | regtest="regtest")
- change the default Bitcoin RPC parameters:
  - `rpcHost`
  - `rpcPort`
  - `rpcUser`
  - `rpcPassword`
- change the default authentication parameters (see [Authentication](#Authentication)):
  - `enabled` which enables authentication checks on the api endpoints
  - `jwtKey` the ECDSA private key (32 bytes hex-string) used to generate the JSON Web Token (JWT)

If you need to change the settings dynamically from the environment variables, you overwrite them using the environment variable *NODE_CONFIG*. Such as this:

```
export NODE_CONFIG='{"port": 9003}'
npm start
```

Or for docker:

```
docker run --publish 9002:9002 --detach --name minerid --env NODE_CONFIG='{"bitcoin":{"rpcHost":"host.docker.internal"}}' minerid:1.1.1
```

For more information, you can read the [documentation](https://github.com/lorenwest/node-config/wiki/Environment-Variables#node_config) of the config package.

## Running the project

### Nodejs

To run API server:
```console
$ npm start
```

To run CLI:
```console
$ npm run cli
```

### Docker

You can find the public Docker Hub repository for MinerId [here](https://hub.docker.com/r/bitcoinsv/minerid).

#### Build Image

```console
$ docker build . -t minerid_reference:1.1.1
```


#### Run

To run MinerId you need to specify which network to run on (mainnet="livenet" | testnet="testnet" | regtest="regtest"), and if [`regtest`](https://github.com/jadwahab/regtest), then you will need to specify the Bitcoin RPC credentials in order to MinerId to have access to it.  

By default, it will run on regtest:

```console
docker run --publish 9002:9002 \
    --name minerid \
    --env NODE_CONFIG='{"bitcoin":{"rpcHost":"host.docker.internal"}}' \
    --detach \
    bitcoinsv/minerid:1.1.1
```

#### Volumes

Since MinerId is essentially a service built around a private key (MinerId) we recommend running the container with volumes in order to avoid the situation where the container falls over for some reason and the private key is lost. In the environment variables, we are specifying which network (`livenet` (or mainnet), `testnet`, or `regtest`) and what Bitcoin node RPC parameters and credentials to use by passing them to `NODE_CONFIG`.  

#### Run with [docker-compose](docker-compose.yml)

Change any settings in the [docker-compose](docker-compose.yml) to fit your configuration, then run the container.

```console
$ docker-compose up -d
```

#### Initial Setup

Once the docker container is running, you will need to setup and configure your Miner ID by generating a Miner ID private key as well as a Revocation Key private key. You can do that using `docker exec`:

```console
$ docker exec -it <CONTAINER> bash

root@2623e1f4ed4e:/app#
```

Then run the cli command to setup and configure the above:

```console
root@2623e1f4ed4e:/app# npm run cli -- generateminerid --name testMiner
```


## Authentication

This service uses [JWT tokens](https://tools.ietf.org/html/rfc7519) for authentication. The `authentication.jwtKey` [config](config/default.json) is used for all tokens.  To revoke all tokens, change this key. To generate a new `jwtKey`, run the following script:

```console
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

To generate a JTW token for a user of MinerId, run the `generate_jwt` npm command (you can also set the expiry time in the [generateJWT](config/generateJWT.js) file):

```console
$ npm run generate_jwt <USER_NAME>
```

## Testing

```console
$ npm test
```

## CLI

### Options

  `--command string[]    generateminerid, getcurrentminerid, rotateminerid, rotaterevocationkey, revokemineridpartially, revokemineridcompletely, upgrademinerid, config`

  `-h, --help            Display this usage guide.`

  `-m, --minerid         The compromised minerId public key to be revoked.`

  `-f, --firstminerid    The first minerId public key used in the first Miner ID reputation chain.`

  `-t, --height number   The block height that will be included in the miner-info document.`

  `-n, --name string     The alias for the minerId. This shouldn't change while the minerId may be changed by rotating it.`


### Examples

  Generate a new minerId. This will generate a minerId and associate it with the alias name

```console
$ npm run cli -- generateminerid --name foo
``` 
  or  
```console
$ npm run cli -- generateminerid -n foo
```

  Get the current minerId.

```console
$ npm run cli -- getcurrentminerid --name foo
```
  or
```console
$ npm run cli -- getcurrentminerid -n foo
```
  
  Generate op_return with signed coinbase document.  
  
```console
$ npm run cli -- --height 5123123 --name foo
```

  Add a key value pair to the config file. This will be used to fill the `minerContact` object. You can add any key value pairs here but you should add one called `name` as this can then be used to identify you. Obviously this doesn't have to be your real name but should be something you're happy to share with the world.
  
```console
$ npm run cli -- config email=sami@foo.com -n foo
``` 
  or  
```console
$ npm run cli -- config website=foo.com -n foo
```

  Rotate a minerId key. This command rotates the current minerId which generates a new one. Subsequent miner-info documents will contain references to both minerIds.

```console
$ npm run cli -- rotateminerid --name foo
```

  Rotate a revocationKey key. This command rotates the current revocationKey which generates a new one. Subsequent miner-info documents will contain references to both revocationKeys.

```console
$ npm run cli -- rotaterevocationkey --name foo
```
  or
```console
$ npm run cli -- rotaterevocationkey -n foo
```

  Partial minerId revocation. Revokes rotated MinerID reputation chains. It cannot revoke the initial chain.

```console
$ npm run cli -- revokemineridpartially --minerid minerId --name foo
```
  or
```console
$ npm run cli -- revokemineridpartially -m minerId -n foo
```

  Complete minerId revocation. Revokes all Miner ID reputation chains starting from the initial chain.

```console
$ npm run cli -- revokemineridcompletely --name foo
```
  or
```console
$ npm run cli -- revokemineridcompletely -n foo
```

  Upgrade minerId v0.1/v0.2 protocol data to v0.3. It updates an existing configuration to be compliant with the newest protocol version.

```console
$ npm run cli -- upgrademinerid --firstminerid minerId --name  foo
```
  or
```console
$ npm run cli -- upgrademinerid -f minerId -n  foo
```


## API

## Implementation

The **REST API** has 4 endpoints:

### 1. `GET /opreturn/:alias/:blockHeight([0-9]+)`

`alias`: MinerId alias  
`blockHeight`: block height which miner-info document is created for/at

**returns** Miner-info output (locking) script hex string for an `alias` MinerId at height `blockHeight`

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/1234

006a04601dface01004db5027b2276657273696f6e223a22302e33222c22686569676874223a313233342c22707265764d696e65724964223a22303330383230633061663561383937393839366330616433313236363463666136633237653639353461323438613230666265336263303334323531366566353161222c22707265764d696e65724964536967223a223330343430323230303362363061643966663633396465646133396439333231663237663631623539333737363232313332656464393962616239313335303938303966396330323032323032656138656232656566333963313738663861356435346139633532376166343138333464366665663430613031356236373663656433373036663061356239222c226d696e65724964223a22303330383230633061663561383937393839366330616433313236363463666136633237653639353461323438613230666265336263303334323531366566353161222c22707265765265766f636174696f6e4b6579223a22303264326334323462353539623363346564386335353966343033623631373430396531303932323166303337623865613864303831613262646330643138303564222c227265766f636174696f6e4b6579223a22303264326334323462353539623363346564386335353966343033623631373430396531303932323166303337623865613864303831613262646330643138303564222c22707265765265766f636174696f6e4b6579536967223a22333034343032323036626430623437636631393465326263343664373161386164373135323731396439663364373934396138653338623534366439613261613038623761623133303232303333663433303135346236643339666561396336303464393832633334666133666262303330656465
```

### 2. `POST /coinbase2`

body:
```json
{ 
  "alias": string,
  "minerInfoTxId": string,
  "prevhash": string,
  "merkleProof": an array of strings,
  "coinbase2": string
}
```

**returns** updated coinbase2 with the miner-info coinbase output included


|     Field     	|  Function  	|
|------------	|-------	|
| `alias` 	| Alias of the Miner ID 	|
| `minerInfoTxId` 	|  Transaction ID of the transaction containing the miner-info document		|
| `prevhash` 	| Hash of the previous block 	|
| `merkleProof` 	| Merkle branch for the block 	|
| `coinbase2` 	| Second part of the coinbase (`coinb2`) as shown in the [stratum protocol](https://slushpool.com/help/topic/stratum-protocol/) 	|

>Note: The coinbase transaction is split up in the [stratum protocol](https://slushpool.com/help/topic/stratum-protocol/) as follows:

![cb tx](https://i.imgur.com/Am8zt7a.png)

#### Example

```json
{
    "alias": "testMiner",
    "minerInfoTxId": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
    "prevhash": "000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47",
    "merkleProof": ["d4298cf4e2199228af168ad6a998e5bd656cdc7776b8151c37066983b6367a45", "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"],
    "coinbase2":"ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000"
}
```

```console
$ curl -d '{"alias":"testMiner","minerInfoTxId":"f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16", "prevhash": "000000000000000002d9865865d4d7b9dea7f3d09cf0ad51082a91c5d5acbd47", "merkleProof": ["d4298cf4e2199228af168a
d6a998e5bd656cdc7776b8151c37066983b6367a45", "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16"], "coinbase2":"ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000"}' -H "Content-Type: application/json" -X POST localhost:9
002/coinbase2

ffffffff021a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac000000000000000093006a04601dface010020f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e1620367aa3e373a0dcc0629c5d67b4d1212cfb77cadd13ccaf581d48fc2291d751c8473045022100eebb42d9caa87e84e518c1cbb43f8b740524672ece37454e50407419dcccbd1202202af55e5ef1438240627e4663ac0e15772f42c47fe748e70cc
```

### 3. `GET /opreturn/:alias/rotate`

`alias`: MinerId alias  

rotates the MinerId key for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/rotate

OK
```

### 4. `GET /minerid/:alias`

`alias`: MinerId alias  

**returns** compressed public key (33 byte) hex string for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/minerid/testMiner

02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc6326a
```

### 5. `GET /minerid/:alias/sign/:hash`

`alias`: MinerId alias  
`hash`: SHA256 hash (32 byte hex string) to be fed to ECDSA signing algorithm


**returns**  signature (71-73 byte hex string) using an `alias` MinerId

#### Example

```console
$ curl localhost:9002/minerid/testMiner/sign/02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc632

3045022100e0f86a5b1748ae48b0d10ea305202769d754071272cba0fbb82f74f8e8da8b530220494351742f3ba9e51b155df15b13f27c927d21956822aedcbb7d179c66d4d4c0
```

### 6. `GET /minerid/:alias/pksign/:hash`

`alias`: MinerId alias  
`hash`: SHA256 hash (32 byte hex string) to be fed to ECDSA signing agorithm


**returns** signature (71-73 byte hex string) using an `alias` MinerId and public key used

#### Example

```console
$ curl localhost:9002/minerid/testMiner/pksign/02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc632
```

response:

```json
{
  "publicKey": "02759b832a3b8ec8184911d533d8b4b4fdc2026e58d4fba0303587cebbc68d21ab",
  "signature": "3044022033e2617bb214368abca8cd977029b349182142a6261b9aef168130a9cf158f9402206f1fe64d57b819edc29c0a26352850545bb343c1acb7cd1ce18a77e0f866f6d6"
}
```


## Example Miner Code

The [examples/testMiner.js](examples/testMiner.js) file contains basic code needed to generate a coinbase transaction that has a miner-info coinbase output in it by calling the first API [endpoint](#1-get-opreturnaliasblockheight0-9) and then adding that output to its coinbase transaction.

1. Generate MinerId:
    ```console
    $ npm run cli -- generateminerid -n testMiner
    ```
   
2. Create Miner ID Coinbase Transaction:
    ```console
    $ node examples/testMiner.js
    ```
