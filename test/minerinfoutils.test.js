const rewire = require('rewire')
const mi = rewire('../utils/minerinfo')

const clonedeep = require('lodash.clonedeep')

const { describe, it } = require('mocha')
const assert = require('assert')

let sample1 = `{
 "cb2": "ffffffff011a0a5325000000001976a9145deb9155942e7d38febc15de8870222fd24d080e88ac00000000",
 "ctxId": "7581d015d05655555914334ef08fbe1e4ea884c51712f34fc113d771d3e507e9",
 "minerInfoTxId": "f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16",
 "blockBind": "86162d5003cbfe8c2c6fdc0606af36855ab293b8fdae8731f548f4d2d39baef6",
 "blockBindSig": "3045022100905ceeac2b7f7a7f6c176374e3c248719f3030b6f87425b55c05a3d428c2054002200c2244b86f0d6d857bb2da11bbed07ce1d5e4ca347f29d387301e526bf5f9b08"
}`
const sm1 = JSON.parse(sample1)

function checkCoinbaseScript(outputParts) {
  // OP_0
  assert.strict.equal(outputParts[0], '0')
  // OP_RETURN
  assert.strict.equal(outputParts[1], 'OP_RETURN')
  // Protocol name
  assert.strict.equal(outputParts[2], '601dface')
  // Protocol Id version
  assert.strict.equal(outputParts[3], '00')
  // Miner-info txid
  assert.strict.equal(outputParts[4], sm1.minerInfoTxId)
}

function checkCoinbaseScript2(outputParts) {
  // Check [0] - [4] fields
  checkCoinbaseScript(outputParts)
  // Block bind
  assert.strict.equal(outputParts[5], sm1.blockBind)
  // Block bind signature
  assert.strict.equal(outputParts[6], sm1.blockBindSig)
}

describe('Miner info utils', function () {
  describe('Merkle root', function () {
    it('can create a Merkle root from coinbase2 and no merkle branches', () => {
      merkleProof = []
      const modifiedMerkleRoot = mi.buildMerkleRootFromCoinbase(sm1.ctxId, merkleProof)
      assert.strict.equal(modifiedMerkleRoot, '7581d015d05655555914334ef08fbe1e4ea884c51712f34fc113d771d3e507e9')
    })

    it('can create a Merkle root from coinbase2 and 2 Merkle branches', () => {
      const merkleProof = [
        'd4298cf4e2199228af168ad6a998e5bd656cdc7776b8151c37066983b6367a45',
        '887ed2c1fcabb86c70fbfdf2bed3fe8760448ca3cac10ed203e67225505fc750'
      ]
      const modifiedMerkleRoot = mi.buildMerkleRootFromCoinbase(sm1.ctxId, merkleProof)
      assert.strict.equal(modifiedMerkleRoot, '377e06114c868db4f4b1cf9ae6bc93999930e7bd25c415a6893eed2b0aa28756')
    })

    it('can create a Merkle root from coinbase hash and 5 Merkle branches', () => {
      const coinbaseHash = '66140d22ba975c50f7383618a4ac7ca5dab919ae4e43f88b0ee79b7cbcccb25a'
      const merkleBranches = [ // merkleProof in getminingcandidate BitCoin RPC call
        // see: https://github.com/bitcoin-sv-specs/protocol/blob/master/rpc/GetMiningCandidate.md
        '801fc07c69466a2216c55c185b69138fd98eb640abced94114868eada3adf180',
        'c1d8cec3243f0c689bc48545cf843e59c1efc859811024587defb9948fd76c18',
        'ffa3bf57d06df2dcf4158245b94f1211ea6b7e07690a099a6efd794eb7dbd5c4',
        'b558ea838bbc69498b3556c8ff85a2cd197b7295c1bd798308be2be53e940928',
        'dc93ffd1aec55cb7e030d3c22bb176ab2e991181fdc38e1c242132bd42e90e58'
      ]
      const merkleRoot = mi.buildMerkleRootFromCoinbase(coinbaseHash, merkleBranches)
      assert.strict.equal(merkleRoot, '4613bbcb10e2d0192bc2f226baf2a973842bdb47053ecca90d8d4540ec5ec4c0')
    })
  })

  describe('Miner-info script', function () {
    it('can make a script with miner-info-doc and sig(miner-info-doc)', () => {
      const minerInfoDocJson = '{"version":"0.3","height":100,"prevMinerId":"0257b61d90a166f7cc968ecb7c88101b90065f89d90254d9a7322dac1b43f30c2e","prevMinerIdSig":"30440220519b09620bac825803181cdfd6286b6ed56af688c21407d3401212ec6499c8cc02201cb903b622da00eb3d1d631fac66ec79f44f9c96dcbf3ad7c8dfd0ed4bcfe5ee","minerId":"0257b61d90a166f7cc968ecb7c88101b90065f89d90254d9a7322dac1b43f30c2e","prevRevocationKey":"02d1d4b1c72efa37158eb6d1298303a3b65924af03a481705e76ee405fd9b0207d","revocationKey":"02d1d4b1c72efa37158eb6d1298303a3b65924af03a481705e76ee405fd9b0207d","prevRevocationKeySig":"3045022100d1d5084912fa27f5e9e6bd5f465cb8790760934094daab060d7f677653fb5268022061b5a4bf45baa73e2e033122075d3a1077468397065a113d71969864387f7395"}'
      const minerInfoDocSig = '3045022100819a03d3838bec280be1105c290c29dcab49d9a458f429eb2ed4f696733958ec02207e599b50e88bc555f9db840f2707b3e3105df5dd97d09a8501f506c8e0019c64'
      const script = mi.createMinerInfoOpReturnScript(JSON.stringify(minerInfoDocJson), Buffer.from(minerInfoDocSig, 'hex'))
      const outputParts = script.toASM().split(' ')
      // OP_0
      assert.strict.equal(outputParts[0], '0')
      // OP_RETURN
      assert.strict.equal(outputParts[1], 'OP_RETURN')
      // Protocol name
      assert.strict.equal(outputParts[2], '601dface')
      // Protocol Id version
      assert.strict.equal(outputParts[3], '00')
      // Miner-info doc
      assert.strict.equal(outputParts[4], '227b5c2276657273696f6e5c223a5c22302e335c222c5c226865696768745c223a3130302c5c22707265764d696e657249645c223a5c223032353762363164393061313636663763633936386563623763383831303162393030363566383964393032353464396137333232646163316234336633306332655c222c5c22707265764d696e657249645369675c223a5c2233303434303232303531396230393632306261633832353830333138316364666436323836623665643536616636383863323134303764333430313231326563363439396338636330323230316362393033623632326461303065623364316436333166616336366563373966343466396339366463626633616437633864666430656434626366653565655c222c5c226d696e657249645c223a5c223032353762363164393061313636663763633936386563623763383831303162393030363566383964393032353464396137333232646163316234336633306332655c222c5c22707265765265766f636174696f6e4b65795c223a5c223032643164346231633732656661333731353865623664313239383330336133623635393234616630336134383137303565373665653430356664396230323037645c222c5c227265766f636174696f6e4b65795c223a5c223032643164346231633732656661333731353865623664313239383330336133623635393234616630336134383137303565373665653430356664396230323037645c222c5c22707265765265766f636174696f6e4b65795369675c223a5c22333034353032323130306431643530383439313266613237663565396536626435663436356362383739303736303933343039346461616230363064376636373736353366623532363830323230363162356134626634356261613733653265303333313232303735643361313037373436383339373036356131313364373139363938363433383766373339355c227d22')
      assert.strict.equal(outputParts[5], '3045022100819a03d3838bec280be1105c290c29dcab49d9a458f429eb2ed4f696733958ec02207e599b50e88bc555f9db840f2707b3e3105df5dd97d09a8501f506c8e0019c64')
    })
  })

  describe('Coinbase script', function () {
    it('can make a script with miner-info-txid', () => {
      const script = mi.createCoinbaseOpReturnScript(sm1.minerInfoTxId)
      const outputParts = script.toASM().split(' ')
      checkCoinbaseScript(outputParts)
    })

    it('can make a script with miner-info-txid, blockBind and blockBindSig', () => {
      const createCoinbaseOpReturnScript2 = mi.__get__('createCoinbaseOpReturnScript2')
      const script = createCoinbaseOpReturnScript2(sm1.minerInfoTxId, sm1.blockBind, sm1.blockBindSig)
      const outputParts = script.toASM().split(' ')
      checkCoinbaseScript2(outputParts)
    })
  })

  describe('Coinbase transaction', function () {
    it('can make a coinbase transaction from cb1 & cb2 parts', () => {
      assert.strict.equal(mi.makeCoinbaseTx(mi.placeholderCB1, Buffer.from(sm1.cb2, 'hex')).id, sm1.ctxId)
    })

    it('can make a coinbase transaction with an output script containing miner-info-txid', () => {
      const ctx = mi.makeCoinbaseTx(mi.placeholderCB1, Buffer.from(sm1.cb2, 'hex'))
      const ctx2 = mi.createMinerInfoCoinbaseTx(ctx, sm1.minerInfoTxId)
      assert.strict.equal(ctx2.id, '3b30ed54514a02dea1fe7246dd112dc80bafa82a7d28083912e19ea772c30e81')
      const script = ctx2.outputs[1].script
      const outputParts = script.toASM().split(' ')
      checkCoinbaseScript(outputParts)
    })

    it('can make a coinbase transaction with an output script containing: miner-info-txid, blockBind and blockBindSig', () => {
      const ctx = mi.makeCoinbaseTx(mi.placeholderCB1, Buffer.from(sm1.cb2, 'hex'))
      const ctx2 = mi.createMinerInfoCoinbaseTxWithBlockBind(ctx, sm1.minerInfoTxId, sm1.blockBind, sm1.blockBindSig)
      assert.strict.equal(ctx2.id, '5d34b9489fa27c6a868219c371a62d4a9003f4bb76eed60e40da7ec19b2bc949')
      const script = ctx2.outputs[1].script
      const outputParts = script.toASM().split(' ')
      checkCoinbaseScript2(outputParts)
    })
  })
})
