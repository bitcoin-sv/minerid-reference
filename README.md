# Miner ID Generator - Reference Implementation

More details available in the [BRFC Specification](https://github.com/bitcoin-sv-specs/brfc-minerid) for the Miner ID Protocol.

## Support

For support and general discussion of both standards and reference implementations please join the following [telegram group](https://t.me/joinchat/JB6ZzktqwaiJX_5lzQpQIA).

## Requirements

For development, you will only need Node.js _(minimum 10.12.0)_ and a node global package, NPM, installed in your environment.

### Node

#### Node installation on Windows

Just go to [official Node.js website](https://nodejs.org/) and download the installer. Also, be sure to have `git` available in the PATH environment variable, `npm` might need it (You can find git [here](https://git-scm.com/)).

#### Node installation on Ubuntu

You can install `nodejs` and `npm` easily using `apt install`, just run the following commands.

```console
$ sudo apt install nodejs
$ sudo apt install npm
```

#### Other Operating Systems

You can find more information about the installation on the [official Node.js website](https://nodejs.org/) and the [official NPM website](https://npmjs.org/).

## Installation

```console
$ git clone https://github.com/bitcoin-sv/minerid-reference.git
$ cd minerid-reference
$ npm install
```

## Configuration

Open [config/default.json](config/default.json) and edit it with your settings:  

- specify the `port` number
- set `debug=true` to enable debug logging
- change _(or leave)_ the default `minerIdDataPath` config which points to the user's minerIds location _(interpreted as `~/${minerIdDataPath}`)_
- change _(or leave)_ the default `keystorePath` config which points to the minerId private keys keystore _(interpreted as `~/${keystorePath}`)_
- change _(or leave)_ the default `revocationKeystorePath` config which points to the revocation private keys keystore _(interpreted as `~/${revocationKeystorePath}`)_
- specify the `network` _(mainnet="livenet" | testnet="testnet" | regtest="regtest")_
- specify the Bitcoin RPC parameters:
  - `rpcHost`
  - `rpcPort`
  - `rpcUser`
  - `rpcPassword`
- specify the authentication parameters _(see [Authentication](#Authentication))_:
  - `enabled` which enables authentication checks on the api endpoints
  - `jwtKey` the ECDSA private key _(a 32 byte hex-string)_ used to generate the JSON Web Token _(JWT)_

If you need to change the settings dynamically from the environment variables, you overwrite them using the environment variable *NODE_CONFIG*. Such as this:

```
export NODE_CONFIG='{"port": 9003}'
npm start
```

Or for docker:

```
docker run --publish 9002:9002 --detach --name minerid --env NODE_CONFIG='{"bitcoin":{"rpcHost":"host.docker.internal"}}' minerid:2.0.0
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
$ docker build . -t minerid_reference:2.0.0
```

#### Run

To run MinerId you need to specify which network to run on _(mainnet="livenet" | testnet="testnet" | regtest="regtest")_, and if [`regtest`](https://github.com/jadwahab/regtest), then you will need to specify the Bitcoin RPC credentials in order to MinerId to have access to it.

By default, it will run on _regtest_:

```console
docker run --publish 9002:9002 \
    --name minerid \
    --env NODE_CONFIG='{"bitcoin":{"rpcHost":"host.docker.internal"}}' \
    --detach \
    bitcoinsv/minerid:2.0.0
```

#### Volumes

Since MinerId is essentially a service built around a private key _(MinerId)_ we recommend running the container with volumes in order to avoid the situation where the container falls over for some reason and the private key is lost. In the environment variables, we are specifying which network _(`livenet` (or mainnet), `testnet`, or `regtest`)_ and what Bitcoin node RPC parameters and credentials to use by passing them to `NODE_CONFIG`.

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

The **REST API** has 9 endpoints:

### 1. `GET /datarefs/:alias/opreturns`

`alias`: MinerId alias

**returns** An array of dataRefs output _(locking)_ scripts _(hex strings)_ for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/datarefs/testMiner/opreturns

["006a04601dface0100257b22363262323135373263613436223a7b7d2c22613232343035326164343333223a7b7d7d"]
```

### 2. `GET /opreturn/:alias/:blockHeight([0-9]+)`

`alias`: MinerId alias  
`blockHeight`: block height which miner-info document is created for/at

**returns** Miner-info output _(locking)_ script hex string for an `alias` MinerId at height `blockHeight`

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/1234

006a04601dface01004db5027b2276657273696f6e223a22302e33222c22686569676874223a313233342c22707265764d696e65724964223a22303330383230633061663561383937393839366330616433313236363463666136633237653639353461323438613230666265336263303334323531366566353161222c22707265764d696e65724964536967223a223330343430323230303362363061643966663633396465646133396439333231663237663631623539333737363232313332656464393962616239313335303938303966396330323032323032656138656232656566333963313738663861356435346139633532376166343138333464366665663430613031356236373663656433373036663061356239222c226d696e65724964223a22303330383230633061663561383937393839366330616433313236363463666136633237653639353461323438613230666265336263303334323531366566353161222c22707265765265766f636174696f6e4b6579223a22303264326334323462353539623363346564386335353966343033623631373430396531303932323166303337623865613864303831613262646330643138303564222c227265766f636174696f6e4b6579223a22303264326334323462353539623363346564386335353966343033623631373430396531303932323166303337623865613864303831613262646330643138303564222c22707265765265766f636174696f6e4b6579536967223a22333034343032323036626430623437636631393465326263343664373161386164373135323731396439663364373934396138653338623534366439613261613038623761623133303232303333663433303135346236643339666561396336303464393832633334666133666262303330656465
```

### 3. `GET /opreturn/:alias/:blockHeight([0-9]+)/:dataRefsTxId`

`alias`: MinerId alias  
`blockHeight`: block height which miner-info document is created for/at
`dataRefsTxId`: dataRefs transaction id to which the current miner-info document refers to. The dataRefs transaction must be contained in the same block as the current miner-info document

**returns** Miner-info output _(locking)_ script hex string for an `alias` MinerId at height `blockHeight` referencing `dataRefsTxId` transaction

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/1234/031998a203804868a69e920678116f5994a4e9317ed22fea6be148e215b4af9b

006a04601dface01004d02047b2276657273696f6e223a22302e33222c22686569676874223a313233342c22707265764d696e65724964223a22303330383230633061663561383937393839366330616433313236363463666136633237653639353461323438613230666265336263303334323531366566353161222c22707265764d696e6572
4964536967223a223330343430323230303362363061643966663633396465646133396439333231663237663631623539333737363232313332656464393962616239313335303938303966396330323032323032656138656232656566333963313738663861356435346139633532376166343138333464366665663430613031356236373663
656433373036663061356239222c226d696e65724964223a22303330383230633061663561383937393839366330616433313236363463666136633237653639353461323438613230666265336263303334323531366566353161222c22707265765265766f636174696f6e4b6579223a2230326432633432346235353962336334656438633535
3966343033623631373430396531303932323166303337623865613864303831613262646330643138303564222c227265766f636174696f6e4b6579223a22303264326334323462353539623363346564386335353966343033623631373430396531303932323166303337623865613864303831613262646330643138303564222c2270726576
5265766f636174696f6e4b6579536967223a22333034343032323036626430623437636631393465326263343664373161386164373135323731396439663364373934396138653338623534366439613261613038623761623133303232303333663433303135346236643339666561396336303464393832633334666133666262303330656465
6164333839373836643437373761336631633464343639222c226d696e6572436f6e74616374223a7b22656d61696c223a227461616c31407461616c2e636f6d227d2c22657874656e73696f6e73223a7b226461746152656673223a7b2272656673223a5b7b2262726663496473223a5b22363262323135373263613436222c2261323234303532
6164343333225d2c2274786964223a2230333139393861323033383034383638613639653932303637383131366635393934613465393331376564323266656136626531343865323135623461663962222c22766f7574223a307d2c7b2262726663496473223a5b22313262323135373263613434222c22623232343035326164343232225d2c22
74786964223a2230333139393861323033383034383638613639653932303637383131366635393934613465393331376564323266656136626531343865323135623461663962222c22766f7574223a317d5d7d7d7d463044022029be6c135b6dfe18aaf9fd9af04f026ad92a783184809c22fe30f7e944d86bb502206df04c6b0af56fb2fa0790
1414b5588bd72204435f0645ecb08c7a08a0fe69d1
```

### 4. `POST /coinbase2`

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


| **Field** | **Function** |
| :------------- | :--------------------------------------------------------------- |
| `alias` 	  | Alias of the Miner ID. |
| `minerInfoTxId` | Transaction ID of the transaction containing the miner-info document. |
| `prevhash`      | Hash of the previous block. |
| `merkleProof`   | Merkle branch for the block. |
| `coinbase2`     | Second part of the coinbase _(coinb2)_ as shown in the [stratum protocol](https://slushpool.com/help/topic/stratum-protocol/) document. |

> Note: The coinbase transaction is split up in the [stratum protocol](https://slushpool.com/help/topic/stratum-protocol/) as follows:

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

### 5. `GET /opreturn/:alias/rotate`

`alias`: MinerId alias  

rotates the MinerId key for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/rotate

OK
```

### 6. `GET /minerid/:alias`

`alias`: MinerId alias  

**returns** compressed public key _(a 33 byte hex string)_ for an `alias` MinerId

#### Example

```console
$ curl localhost:9002/minerid/testMiner

02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc6326a
```

### 7. `GET /minerid/:alias/sign/:hash`

`alias`: MinerId alias  
`hash`: SHA256 hash _(a 32 byte hex string)_ to be fed to ECDSA signing algorithm


**returns**  signature _(a 71-73 byte hex string)_ using an `alias` MinerId

#### Example

```console
$ curl localhost:9002/minerid/testMiner/sign/02644f5000535bbc135f9c8613f86f10c66a4a773eda5e913eff64eb328bc632

3045022100e0f86a5b1748ae48b0d10ea305202769d754071272cba0fbb82f74f8e8da8b530220494351742f3ba9e51b155df15b13f27c927d21956822aedcbb7d179c66d4d4c0
```

### 8. `GET /minerid/:alias/pksign/:hash`

`alias`: MinerId alias  
`hash`: SHA256 hash _(a 32 byte hex string)_ to be fed to ECDSA signing agorithm


**returns** signature _(a 71-73 byte hex string)_ using an `alias` MinerId and public key used

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

### 9. `GET /opreturn/:alias/isvalid`

`alias`: MinerId alias

**returns** 'true' if the last generated miner-info op_return script _(using `GET /opreturn/:alias/:blockHeight([0-9]+)` or `GET /opreturn/:alias/:blockHeight([0-9]+)/:dataRefsTxId`)_ is still valid _(a key rotation or revocation has not been executed by an administrator using CLI commands)_ for an `alias` MinerId and 'false' otherwise.

#### Example

```console
$ curl localhost:9002/opreturn/testMiner/isvalid

true
```

## Extensions support

Static extensions are expected to be defined in the `minerIdOptionalData` configuration data file. Its expected location is the `~/.minerid-client/:alias` folder.

### minerIdOptionalData config file

The `minerIdOptionalData` config file can contain any optional information which an operator wants to include in the miner-info document, e.g., minerContact or extensions.

> Note: The file is created and the `minerContact` section is added automatically if an operator executes the `npm run cli -- config` CLI command. However, the `extensions` section must be added manually into the file.

#### Example
```console
{
  "minerContact": {
    "email": "support@miner.com"
  },
  "extensions": {
    "PublicIP":"127.0.0.1",
    "PublicPort": 8888
  }
}
```

## DataRefs support

It is possible either to create a new dataRefs transaction or to refer to an existing one(s). The MID Generator controls that process using configuration data files listed below.

### dataRefsTxData config file

The `dataRefsTxData` config file defines what must be contained in a new dataRefs transaction. Its expected location is the `~/.minerid-client/:alias` folder. If this config file exists, then the Generator is instructed to create and return a dataRefs op_return output script(s) through `GET /datarefs/:alias/opreturns` request. The first call to `GET /opreturn/:alias/:blockHeight([0-9]+)/:dataRefsTxId` method creates a new `dataRefs` config file _(or overwrites the existing one)_ based on the existing `dataRefsTxData` configuration and `dataRefsTxId` specified in the request. The entire content of the `dataRefs` config file is then added to the miner-info document under **extensions** section.

#### Example
```console
{
   "dataRefs": {
     "refs": [
       {
         "brfcIds": ["62b21572ca46", "a224052ad433"],
         "data": {
           "62b21572ca46": {
              "alpha": 1
           },
           "a224052ad433": {
              "omega": 800
           }
         },
         "vout": 0
       }
     ]
   }
}
```

### dataRefs config file

An operator may want to link a minerId key with an existing dataRefs transaction(s). To do that the Generator requires to create and configure the `dataRefs` config file, only _(its content will be added to the miner-info document under **extensions** section)_. The `dataRefs` file must be placed in the `~/.minerid-client/:alias` folder.

> Note: A presence of the `dataRefsTxData` config file will cause the existing `dataRefs` config file to be overwritten during processing.

#### Example
```console
{
  "dataRefs": {
    "refs": [
      {
        "brfcIds": [
          "62b21572ca46",
          "a224052ad433"
        ],
        "txid": "c2835431b7486a732897bc64bf04c4c751c820d298ee9d181dfa433f0023dcda",
        "vout": 0
      }
    ]
  }
}
```

## Example Miner Code

The [examples/testMiner.js](examples/testMiner.js) script contains basic code needed to:
- create dataRefs and miner-info transactions
- generate a miner ID coinbase transaction that has a miner-info coinbase output in it
- mine a miner ID block

> Note: The script requires an extra configuration. Please, read the _Prerequisites_ section in the script.

1. Generate MinerId:
    ```console
    $ npm run cli -- generateminerid -n testMiner
    ```
   
2. Create a miner ID coinbase transaction and mine a miner ID block:
    ```console
    $ node examples/testMiner.js
    ```
