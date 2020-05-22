const rewire = require('rewire')
const blockbind = rewire('../plugins/blockbind')

const { describe, it } = require('mocha')
const assert = require('assert')

describe('Extensions', function () {
  describe('Blockbind', function () {
    it('can create a Merkle root from coinbase tx and 2 Merkle branches', () => {
      const expectedRoot = '4feefbd7dc07a34f4138a1d934d3d2115fcff632a9a5bbde79ad9313c60cd8b4'

      const coinbaseHash = '7f598b52740073005bd2f4f9cabfc30ce60198c3627cd4671477d26921962753'
      const merkleBranches = [ // merkleProof in getminingcandidate BitCoin RPC call
        // see: https://github.com/bitcoin-sv-specs/protocol/blob/master/rpc/GetMiningCandidate.md
        '9bd12ce6508574b3163aadb14eab7bd862306da85b221eb284fb41d6012db98f',
        '56f04cc78ac493defced65dd58f4437c67bcc697b59778b0cd96c3c64c1b0bbf'
      ]

      const buildMerkleRootFromCoinbase = blockbind.__get__('buildMerkleRootFromCoinbase')
      const merkleRoot = buildMerkleRootFromCoinbase(coinbaseHash, merkleBranches)

      assert.strict.equal(merkleRoot, expectedRoot)
    })

    it('can create a Merkle root from coinbase tx and 5 Merkle branches', () => {
      const expectedRoot = '4613bbcb10e2d0192bc2f226baf2a973842bdb47053ecca90d8d4540ec5ec4c0'

      const coinbaseHash = '66140d22ba975c50f7383618a4ac7ca5dab919ae4e43f88b0ee79b7cbcccb25a'
      const merkleBranches = [ // merkleProof in getminingcandidate BitCoin RPC call
        // see: https://github.com/bitcoin-sv-specs/protocol/blob/master/rpc/GetMiningCandidate.md
        '801fc07c69466a2216c55c185b69138fd98eb640abced94114868eada3adf180',
        'c1d8cec3243f0c689bc48545cf843e59c1efc859811024587defb9948fd76c18',
        'ffa3bf57d06df2dcf4158245b94f1211ea6b7e07690a099a6efd794eb7dbd5c4',
        'b558ea838bbc69498b3556c8ff85a2cd197b7295c1bd798308be2be53e940928',
        'dc93ffd1aec55cb7e030d3c22bb176ab2e991181fdc38e1c242132bd42e90e58'
      ]

      const buildMerkleRootFromCoinbase = blockbind.__get__('buildMerkleRootFromCoinbase')
      const merkleRoot = buildMerkleRootFromCoinbase(coinbaseHash, merkleBranches)

      assert.strict.equal(merkleRoot, expectedRoot)
    })
  })
})
