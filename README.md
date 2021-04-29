# MinerId Builder - Reference Implementation

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

- change `port`
- change `minerIdDataPath` which stores user's minerids  
- change `keystore` which stores minerId private keys  
- change `network` (mainnet="livenet" | testnet="testnet" | regtest="regtest")  
- change Bitcoin RPC parameters:
  - `rpcHost`
  - `rpcPort`
  - `rpcUser`
  - `rpcPassword`
- change authentication parameters (see [Authentication](#Authentication)):
  - `enabled` which enables authentication checks on the api endpoints
  - `jwtKey` the key used to generate the jwt

If you are running a private node (different magic number), then change/add 'privateNetwork' and set it to 'true'.
This configuration option is optional, and if not present, then 'false' is assumed.

- change/add `privateNetwork` (false="not running a private network" | true="running a private network, no external calls will be made to any public services")

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

Once the docker container is running, you will need to setup and configure your Miner ID by generating a Miner ID private key as well as setting up your [Validity Check Transaction output (VCTx)](https://github.com/bitcoin-sv-specs/brfc-minerid#323-key-design-decisions). You can do that using `docker exec`:

```console
$ docker exec -it <CONTAINER> bash

root@2623e1f4ed4e:/app#
```

Then run the cli commands to setup and configure the above:

```console
root@2623e1f4ed4e:/app# npm run cli -- generateminerid --name testMiner
```

```console
root@2623e1f4ed4e:/app#  npm run cli -- generatevctx --name testMiner
```

If you are running on `livenet` (mainnet), follow the instructions to fund your VCTx.

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

  `--command string[]    generatevctx, rotateid, config`

  `-h, --help            Display this usage guide.`

  `-t, --height number   The block height that will be included in the coinbase document.`

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
  
  Generate a Validity Check Transaction (VCTX).  
  
```console
$ npm run cli -- generatevctx --name foo
```

  Generate op_return with signed coinbase document.  
  
```console
$ npm run cli -- --height 5123123 --name foo
```

  Rotate a minerId. This command rotates the minerId which generates a new one. This is done by spending the current VCTX to create a new VCTX with the new minerId in op_return. Subsequent coinbase documents will contain references to both minerIds
  
```console
$ npm run cli -- rotateminerid --name foo
```

  Add a key value pair to the config file. This will be used to fill the `minerContact` object. You can add any key value pairs here but you should add one called `name` as this can then be used to identify you. Obviously this doesn't have to be your real name but should be something you're happy to share with the world.
  
```console
$ npm run cli -- config email=sami@foo.com -n foo
``` 
  or  
```console
$ npm run cli -- config website=foo.com -n foo
```

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

006a04ac1eed884de3017b2276657273696f6e223a22302e31222c22686569676874223a313233342c22707265764d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c22707265764d696e65724964536967223a2233303435303232313030663133343563643963343838646236616462636663316566313762663039646335363734636361336439623663333563306437396634333462376639333332393032323033363065303431363130373865653666343333663131633066356439666136353030633134653431666635643764323432666162343161656338336534323462222c226d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c2276637478223a7b2274784964223a2236383339303038313939303236303938636337386266356633346339613662646637613830303963396630313966383339396337636131393435623461346666222c22766f7574223a307d2c226d696e6572436f6e74616374223a7b226e616d65223a22746573744d696e6572227d7d4630440220365fd836bb566dcdf2c1bca13e3fa45adc21d9bb5118e79a5764f7ab92421fd502201006b12b2d8f1de7ac47f4c4d85b5136425ad600d59dc2559c126aec7a941914
```

### 2. `POST /coinbase2`

body:
```json
{ 
  "blockHeight": number,
  "alias": string,
  "coinbase2": string,
  "jobData": {
    "miningCandidate": {},
    "getInfo": {},
    "feeSpec": {}
  }
}
```

**returns** updated coinbase2 with the MinerId output included


|     Field     	|  Function  	|
|------------	|-------	|
| `blockHeight` 	| Height of the block which the coinbase transaction will be in 	|
| `alias` 	| Alias of the Miner ID 	|
| `coinbase2` 	| Second part of the coinbase (`coinb2`) as shown in the [stratum protocol](https://slushpool.com/help/topic/stratum-protocol/) 	|
| `jobData` 	| Data specific to a mining job to be added to the MinerId coinbase document throught the extensions 	|
| `miningCandidate` 	| BitCoin RPC `getminingcandidate` response 	|
| `getInfo` 	| BitCoin RPC `getinfo` response 	|
| `feeSpec` 	| mAPI default `fees` 	|

>Note: The coinbase transaction is split up in the [stratum protocol](https://slushpool.com/help/topic/stratum-protocol/) as follows:

![cb tx](https://i.imgur.com/Am8zt7a.png)

#### Example

```json
{ 
	"blockHeight": 100, 
	"alias": "testMiner", 
	"coinbase2": "ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000", 
	"jobData": {
		"miningCandidate": {
          "id": "e706b0e6-793b-448f-a1ae-8ef54459eb72",
          "prevhash": "70f5701644897c92b60e98dbbfe72e1cfd7a2728c6fa3a29c4b4f6e986b0ccaa",
          "coinbaseValue": 5000000974,
          "version": 536870912,
          "nBits": "207fffff",
          "time": 1590152467,
          "height": 106,
          "num_tx": 4,
          "sizeWithoutCoinbase": 1052,
          "merkleProof": [
            "9bd12ce6508574b3163aadb14eab7bd862306da85b221eb284fb41d6012db98f",
            "56f04cc78ac493defced65dd58f4437c67bcc697b59778b0cd96c3c64c1b0bbf"
          ]
        },
        "getInfo": {
          "version": 101000300,
          "protocolversion": 70015,
          "walletversion": 160300,
          "balance": 199.99997068,
          "blocks": 104,
          "timeoffset": 0,
          "connections": 4,
          "proxy": "",
          "difficulty": 4.656542373906925e-10,
          "testnet": false,
          "stn": false,
          "keypoololdest": 1575386196,
          "keypoolsize": 1999,
          "paytxfee": 0.00000000,
          "relayfee": 0.00000250,
          "errors": "",
          "maxblocksize": 9223372036854775807,
          "maxminedblocksize": 128000000,
          "maxstackmemoryusagepolicy": 100000000,
          "maxstackmemoryusageconsensus": 9223372036854775807
        },
        "feeSpec": {
          "fees": [
            {
              "feeType": "standard",
              "miningFee": {
                "satoshis": 1,
                "bytes": 1
              },
              "relayFee": {
                "satoshis": 1,
                "bytes": 10
              }
            },
            {
              "feeType": "data",
              "miningFee": {
                "satoshis": 2,
                "bytes": 1000
              },
              "relayFee": {
                "satoshis": 1,
                "bytes": 10000
              }
            }
          ]
        }
	}
}
```

```console
$ curl -d '{"blockHeight":100,"alias":"testMiner","coinbase2":"ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000","jobData":{"miningCandidate":{"prevhash":"70f5701644897c92b60e98dbbfe72e1cfd7a2728c6fa3a29c4b4f6e986b0ccaa","coinbaseValue":5000000974,"num_tx":4,"sizeWithoutCoinbase":1052,"merkleProof":["9bd12ce6508574b3163aadb14eab7bd862306da85b221eb284fb41d6012db98f","56f04cc78ac493defced65dd58f4437c67bcc697b59778b0cd96c3c64c1b0bbf"]},"getInfo":{"maxblocksize":9223372036854776000,"maxminedblocksize":128000000,"maxstackmemoryusagepolicy":100000000,"maxstackmemoryusageconsensus":9223372036854776000},"feeSpec":{"fees":[{"feeType":"standard","miningFee":{"satoshis":1,"bytes":1},"relayFee":{"satoshis":1,"bytes":10}},{"feeType":"data","miningFee":{"satoshis":2,"bytes":1000},"relayFee":{"satoshis":1,"bytes":10000}}]}}}' -H "Content-Type: application/json" -X POST localhost:9002/coinbase2

ffffffff021a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac0000000000000000fdcd04006a04ac1eed884d7c047b2276657273696f6e223a22302e31222c22686569676874223a3130302c22707265764d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c22707265764d696e65724964536967223a2233303435303232313030663133343563643963343838646236616462636663316566313762663039646335363734636361336439623663333563306437396634333462376639333332393032323033363065303431363130373865653666343333663131633066356439666136353030633134653431666635643764323432666162343161656338336534323462222c226d696e65724964223a22303237353962383332613362386563383138343931316435333364386234623466646332303236653538643466626130333033353837636562626336386432316162222c2276637478223a7b2274784964223a2236383339303038313939303236303938636337386266356633346339613662646637613830303963396630313966383339396337636131393435623461346666222c22766f7574223a307d2c226d696e6572436f6e74616374223a7b226e616d65223a22746573744d696e6572227d2c22657874656e73696f6e73223a7b22626c6f636b62696e64223a7b2270726576426c6f636b48617368223a2237306635373031363434383937633932623630653938646262666537326531636664376132373238633666613361323963346234663665393836623063636161222c226d6f6469666965644d65726b6c65526f6f74223a2265636539356461646635623538333738323831343631363537613262316531323034316333633264633361346231383836643933643636623666356431383962227d2c22626c6f636b696e666f223a7b227478436f756e74223a342c2273697a65576974686f7574436f696e62617365223a313035327d2c2266656553706563223a7b2266656573223a5b7b2266656554797065223a227374616e64617264222c226d696e696e67466565223a7b227361746f73686973223a312c226279746573223a317d2c2272656c6179466565223a7b227361746f73686973223a312c226279746573223a31307d7d2c7b2266656554797065223a2264617461222c226d696e696e67466565223a7b227361746f73686973223a322c226279746573223a313030307d2c2272656c6179466565223a7b227361746f73686973223a312c226279746573223a31303030307d7d5d7d2c226d696e6572706172616d73223a7b22706f6c696379223a7b22626c6f636b6d617873697a65223a393232333337323033363835343737363030302c226d6178737461636b6d656d6f72797573616765706f6c696379223a3130303030303030307d2c22636f6e73656e737573223a7b22657863657373697665626c6f636b73697a65223a3132383030303030302c226d6178737461636b6d656d6f72797573616765636f6e73656e737573223a393232333337323033363835343737363030307d7d7d7d463044022012f0c90f7f7fa975badc29c9b1547a0d65266c18011d7238e32831444c3d81550220539d4090f808bdbc80ed4fd1a5f962e2d8f36343b9015b3f17e6a341018eb45b00000000
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

The [examples/testMiner.js](examples/testMiner.js) file contains basic code needed to generate a coinbase transaction that has a MinerId (output) in it by calling the first API [endpoint](#1-get-opreturnaliasblockheight0-9) and then adding that output to it's coinbase transaction.  

1. Generate MinerId:
    ```console
    $ npm run cli -- generateminerid -n testMiner
    ```
   
2. Generate VcTx (not needed for Regtest):
    ```console
    $ npm run cli -- generatevctx -n testMiner
    ```

3. Create coinbase transaction:
    ```console
    $ node examples/testMiner.js
    ```
