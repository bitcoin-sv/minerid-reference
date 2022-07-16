const fm = require('../utils/filemanager')

const bsv = require('bsv')
const os = require('os')

const { describe, beforeEach, afterEach, it } = require('mocha')
const mock = require('mock-fs')
const assert = require('assert')
const sinon = require('sinon')

describe('Optional Miner ID data fields', function () {
  describe('Write & Read data', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
        }
      })
      sinon.stub(console, "log")
      sinon.stub(console, "debug")
    })
    afterEach(() => {
      mock.restore()
      console.log.restore()
      console.debug.restore()
    })

    it('can write/update and read the MinerId JSON config file for "unittest"', async () => {
      // writeMinerContactDataToFile
      fm.writeMinerContactDataToFile('unittest', "email", "test@testDomain.com")
      fm.writeMinerContactDataToFile('unittest', "name", "test")
      fm.writeMinerContactDataToFile('unittest', "phone", "07495380665")
      // readOptionalMinerIdData
      assert.strict.deepEqual(JSON.stringify(fm.readOptionalMinerIdData('unittest')),
	JSON.stringify({'minerContact': { 'email': 'test@testDomain.com', 'name': 'test', 'phone': '07495380665' }}))
      // updateMinerContactData
      fm.updateMinerContactData('unittest', "name", "test2")
      // readOptionalMinerIdData
      assert.strict.deepEqual(JSON.stringify(fm.readOptionalMinerIdData('unittest')),
	JSON.stringify({'minerContact': { 'email': 'test@testDomain.com', 'name': 'test2', 'phone': '07495380665' }}))
    })
  })

  describe('Read data from the mocked config file', function () {
    beforeEach(() => {
      mock({
        [`${os.homedir()}/.minerid-client/unittest`]: {
          aliases: '[ { "name": "unittest_1" } ]',
          minerIdOptionalData: `{
			"minerContact": {
				"email": "test@testDomain.com",
				"name": "test",
				"phone": "07495380665"
			},
			"extensions": {
				"ext1": 1,
				"ext2": 2,
				"ext3": {
					"ext3_1": 1
				}
			}
                    }`,
        }
      })
    })
    afterEach(() => {
      mock.restore()
    })

    it('can read the MinerId JSON config file for "unittest"', async () => {
      assert.strict.deepEqual(JSON.stringify(fm.readOptionalMinerIdData('unittest')),
	JSON.stringify({'minerContact': { 'email': 'test@testDomain.com', 'name': 'test', 'phone': '07495380665' },
			'extensions': { 'ext1': 1, 'ext2': 2, 'ext3': {'ext3_1': 1}}}))
    })
  })
})
