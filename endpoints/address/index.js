/* eslint-disable import/first */
const request = require('request')
const h = require('apis-helpers')
const _ = require('lodash')
const app = require('../../server')

const lookupAddresses = address => new Promise((resolve, reject) => {
  request.get({
    headers: { 'User-Agent': h.browser() },
    url: `https://api.postur.is/PosturIs/ws.asmx/GetPostals?address=${address}`,
  }, (error, response, body) => {
    if (error || response.statusCode !== 200) {
      reject(error)
    }

    // There is a enclosing () in the response
    const data = _.flatten(JSON.parse(body.replace(/[()]/g, '')))

    const results = _.map(data, elem => ({
      street: elem.Gata,
      house: elem.Husnumer,
      zip: elem.Postnumer,
      city: elem.Sveitafelag,
      apartment: elem.Ibud,
      letter: elem.Stafur,
    }))
    resolve(results)
  })
})

app.get('/address/:address?', async (req, res) => {
  const address = (
    req.query.address || req.params.address || ''
  ).replace(' ', '+')

  if (address === '') {
    res.status(400).json({
      error: 'Please provide a valid address to lookup',
    })
  }

  try {
    const results = await lookupAddresses(address)
    res.cache().json({ results })
  } catch (error) {
    res.status(500).json({ error: 'www.postur.is refuses to respond or give back data' })
  }
})

module.exports = lookupAddresses
