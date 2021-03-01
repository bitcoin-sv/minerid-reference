const config = require('config')
const jwt = require('jsonwebtoken')

function authenticateToken (req, res, next) {
  if (!config.get('authentication.enabled')) {
    return next()
  }

  if (!req.headers.authorization) {
    return next('Missing Authorization Header')
  }

  // Gather the jwt access token from the request header
  const token = req.headers.authorization.split('Bearer ')[1]

  if (token == null) return res.sendStatus(401) // if there isn't any token

  jwt.verify(token, config.get('authentication.jwtKey'), (err, data) => {
    if (err) {
      console.log(err)
      return res.sendStatus(403)
    }
    console.log(`User ${data.username} authenticated`)

    req.user = data
    next() // pass the execution off to whatever request the client intended
  })
}

module.exports = { authenticateToken }
