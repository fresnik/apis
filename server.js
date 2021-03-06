/* eslint-disable no-restricted-globals */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable prefer-destructuring */
/* eslint-disable import/first */
/* eslint-disable new-cap */
/**
 * Only for apis.is production environment
 */
if (process.env.NODE_ENV === 'production') {
  process.chdir('/apis/current')
}

const { EventEmitter: EE } = require('events')
const express = require('express')

const fileModule = require('file')
const statuses = require('statuses')
const debug = require('debug')('server')
const Raven = require('raven')
const metricsMiddleware = require('./lib/expressMetrics')

const cache = require('./lib/cache')
const cors = require('./lib/cors')

const app = express()

// Set up error tracking with Sentry
const SENTRY_URL = process.env.SENTRY_URL
const redis = require('./lib/redis')

Raven.config(SENTRY_URL).install()

// The request handler must be the first middleware on the app
app.use(Raven.requestHandler())

// The error handler must be before any other error middleware
app.use(Raven.errorHandler())

if (process.env.NODE_ENV !== 'test') {
  app.use(metricsMiddleware())
  app.get('/metrics', (req, res) => {
    redis.HGETALL('metrics', (error, metrics) => {
      res.json(metrics)
    })
  })
}

module.exports = app

/**
 * Set the spacing to 0 for shorter output
 */
app.set('json spaces', 0)

/**
 * Create an event listener for app
 */
EE.call(app)

/**
 * Cross-origin resource sharing
 */
app.use(cors())

/**
 * Caching layer
 */
app.use(cache())

/**
 * Set up endpoints
 */
fileModule.walkSync('./endpoints', (dirPath, dirs, endpoints) => {
  function requireEndpoint(endpoint) {
    if (endpoint.includes('.js') && endpoint !== 'graphql_schema.js') {
      try {
        require(`./${dirPath}/${endpoint}`)
      } catch (e) {
        console.error('Error loading file', e)
      }
    }
  }

  if (endpoints && dirPath.indexOf('test') < 0) {
    endpoints.forEach(requireEndpoint)
  }
})

app.use((error, req, res, next) => {
  let code = 500
  let message = 'Unknown error'

  if (res.headersSent) {
    console.error('Headers already sent')
    return next()
  }

  if (typeof error === 'number') {
    code = error
    message = statuses[code] || message
  } else if (
    typeof error === 'object' &&
    error.message &&
    error.message.length === 3 &&
    !isNaN(error.message)) {
    code = error.message
    message = statuses[code] || message
  } else {
    // Other errors that might have been swallowed
    debug(error.stack)
    message = error.message
  }

  code = parseInt(code, 10)

  res.status(code).json({ error: message })
})

/**
 * Start the server
 */
const port = process.env.NODE_ENV === 'testing' ? 3101 : 3100
app.listen(port, () => {
  app.emit('ready')
})

app.on('ready', () => {
  debug('Server running at port:', port)
})
