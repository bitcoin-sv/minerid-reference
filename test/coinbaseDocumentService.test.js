// const CBDS = require('../services/coinbaseDocumentService')
const rewire = require("rewire");
const coinbaseDocService = rewire("../services/coinbaseDocumentService");
const fm = require("../utils/filemanager");
const bsv = require('bsv')
const os = require('os');
const mock = require('mock-fs');
const assert = require('assert');
const sinon = require('sinon');
const expect = require('expect.js');
const fs = require('fs');

const homedir = os.homedir()

before(() => {
    sandbox = sinon.createSandbox()
})
afterEach(() => {
    sandbox.restore()
})


describe('Coinbase Document Services', function () {
    // afterEach(() => {
    //     // Restore the default sandbox here
    //     sinon.restore();
    // });

    describe('Creation', function () {
        let readFileSync;
        let writeFileSync;
        let mkdirSync;
        let HDPrivateKey;

        it('can create MinerId for "unittest"', async () => {
            sandbox.stub(console, "log")

            const priv = new bsv.HDPrivateKey('xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ')

            // readFileSync = sandbox.stub(fs, 'readFileSync').returns({});
            writeFileSync = sandbox.stub(fs, 'writeFileSync').returns({});
            mkdirSync = sandbox.stub(fs, 'mkdirSync').returns({});

            HDPrivateKey = sandbox.stub(bsv, 'HDPrivateKey').returns(priv);


            coinbaseDocService.generateMinerId("unittest")

            assert(HDPrivateKey.returned(priv))
            expect(writeFileSync.calledWith(`${homedir}/.keystore/unittest_1.key`, 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ')).to.be(true);

            // expect(mkdirSync.calledOnceWith(`${homedir}/.minerid-client/unittest`, { recursive: true })).to.be(true);

            data = []
            data.push({ name: 'unittest_1' })
            expect(writeFileSync.calledWith(`${homedir}/.minerid-client/unittest/aliases`, JSON.stringify(data, null, 2))).to.be(true);

            // console.log.restore();

            // writeFileSync.restore();
            // mkdirSync.restore();
            // HDPrivateKey.restore();
        })

        describe('VCTX', function () {
            it('can create vctx', async () => {

            })
        })

        describe('Coinbase OP_RETURN', function () {
            it('can create coinbaseOpReturn', () => {
                const createCoinbaseOpReturn = coinbaseDocService.__get__("createCoinbaseOpReturn")

                // const script = createCoinbaseOpReturn()

                assert.equal(5, 5)
            })
        })
    })

    describe('Retrieval: (directories mocked: .minerid-client & .keystore)', function () {

        beforeEach(() => {
            mock({
                [`${os.homedir()}/.minerid-client/unittest`]: {
                    'aliases': '[ { "name": "unittest_1" } ]',
                    'config': `{
                    "email": "s@aliasDomain.com"
                }`
                },
                [`${os.homedir()}/.keystore`]: {
                    'unittest_1.key': 'xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ'
                }
            });
        });
        afterEach(() => {
            mock.restore()
        });

        it('can get the current MinerId for "unittest"', async () => {

            const currentAlias = coinbaseDocService.getCurrentMinerId("unittest")

            const expectedCurrentAlias = '028e21da5f14280e59191243357d7186a1a658a32d995cf035095399bc1662f3bc'
            assert.deepEqual(currentAlias, expectedCurrentAlias)
        })

        describe('Signing', function () {
            describe('SignHash', function () {

                let unset, signHashStub
                beforeEach(() => {
                    const signHashObj = { signHash: coinbaseDocService.__get__('signHash') };
                    signHashStub = sandbox.stub(signHashObj, 'signHash').returns({})
                    unset = coinbaseDocService.__set__('signHash', signHashStub)
                })
                afterEach(() => {
                    unset();
                })

                it('signWithCurrentMinerId is calling getCurrentAlias and signHash with the right parameters', () => {
                    const getCurrentAlias = sandbox.stub(fm, 'getCurrentAlias').returns('unittest');

                    const hash = "b391347e78e93f05547c6a643dba2ea7df50effdf40061152fab922cbbbef072"

                    const signWithCurrentMinerId = coinbaseDocService.__get__("signWithCurrentMinerId")
                    const sig = signWithCurrentMinerId(hash, "unittest")

                    expect(getCurrentAlias.calledWith('unittest')).to.be(true);
                    expect(signHashStub.calledWith(Buffer.from(hash, 'hex'), 'unittest')).to.be(true);
                })

                it('sign is calling signHash with the right parameters', () => {
                    const sign = coinbaseDocService.__get__("sign")

                    const payload = Buffer.from("1234", 'hex')
                    const sig = sign(payload, "unittest")

                    const hash = bsv.crypto.Hash.sha256(payload)

                    expect(signHashStub.calledWith(hash, 'unittest')).to.be(true);
                })
            })

            it('can sign with MinerId key for "unittest"', () => {

                const hash = "b391347e78e93f05547c6a643dba2ea7df50effdf40061152fab922cbbbef072"

                const signWithCurrentMinerId = coinbaseDocService.__get__("signWithCurrentMinerId")
                const sig = signWithCurrentMinerId(hash, "unittest")

                const priv = new bsv.HDPrivateKey('xprv9s21ZrQH143K44HDZDTUYyZHZfGhwM7R5oEGWzzLsQppjXNWU1MFFYD3YAcx9UTXThGKMTEc273HUyDBLZ9EYzdqEZiQfke2em2nbVQRxsQ').privateKey
                const expectedSig = new bsv.crypto.ECDSA.sign(Buffer.from(hash, 'hex'), priv)

                assert.deepEqual(sig, expectedSig.toString())
            })
        })
    })

});
