// pass argument to npm run generate_JWT to add a username

const jwt = require('jsonwebtoken')
const config = require('config')

function generateAccessToken (username) {
  // return jwt.sign(username, config.jwtKey, { expiresIn: '1800s' })

  return jwt.sign(username, config.get('authentication.jwtKey'))
}

const token = generateAccessToken({ username: process.argv.slice(2)[0] })

console.log(token)
