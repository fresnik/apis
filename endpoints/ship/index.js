import request from 'request'
import $ from 'cheerio'
import h from 'apis-helpers'
import app from '../../server'

const parseIsFloat = (str) => parseFloat(str.replace('.', '').replace(',', '.'))

const lookupShip = name => new Promise((resolve, reject) => {
  // Encode shipName so that Icelandic characters will work
  const shipName = encodeURIComponent(name)
  const url = `http://www.samgongustofa.is/siglingar/skrar-og-utgafa/skipaskra/uppfletting?sq=${shipName}`

  request.get({
    headers: { 'User-Agent': h.browser() },
    url,
  }, (error, response, body) => {
    if (error || response.statusCode !== 200) {
      reject('www.samgongustofa.is refuses to respond or give back data')
    }

    const data = $(body)
    const typeDict = {
      BJÖRGUNARSKIP: 'LIFEBOAT',
      DRÁTTARSKIP: 'TUGBOAT',
      'DÝPK. OG SANDSKIP': 'DREDGERSET',
      DÝPKUNARSKIP: 'DREDGER',
      'EFTIRLITS‐ OG BJÖRGUNARSKIP': 'PATROL AND LIFEBOAT',
      FARÞEGASKIP: 'PASSENGERSHIP',
      'FISKI,FARÞEGASKIP': 'FISHING,PASSENGERSHIP',
      FISKISKIP: 'FISHING VESSEL',
      FLOTBRYGGJA: 'PONTOON BRIDGE',
      FLOTKVÍ: 'FLOATING DOCK',
      'FLUTNINGA/BRUNNSKIP': 'CARGO VESSEL LIVE FISH CARRIER',
      FRÍSTUNDAFISKISKIP: '',
      'HAFNSÖGU/DRÁTTARSKIP': 'PILOT‐ AND TUGBOAT',
      HVALVEIÐISKIP: 'FISH.V.WHALE CATCHER',
      LÓÐSSKIP: 'PILOT BOAT',
      'NÓTAVEIÐI/SKUTTOGARI': 'FISH.V.PURSE STEINERS/ST',
      OLÍUSKIP: 'OIL TANKER',
      PRAMMI: 'BARGE',
      RANNSÓKNARSKIP: 'RESEARCH VESSEL',
      SAFNSKIP: 'MUSEUM SHIP',
      SEGLSKIP: 'SAILBOAT',
      SJÓMÆLINGASKIP: '',
      SKEMMTISKIP: 'PLEASURE CRAFT',
      SKÓLASKIP: 'TRAINING VESSEL',
      SKUTTOGARI: 'FISH.V.STERN TRAWLER',
      VARÐSKIP: 'INSPECTION SHIP',
      VINNUSKIP: 'WORKBOAT',
      VÍKINGASKIP: 'VIKING SHIP',
      VÖRUFLUTNINGASKIP: 'DRY CARGO SHIP',
      ÞANGSKURÐARPRAMMI: 'BARGE',
    }
    // Translations from: https:// www.samgongustofa.is/media/siglingar/skip/Vefskipaskra-2012.pdf
    // https://www.iho.int/mtg_docs/com_wg/CSBWG/CSBWG2/CSBWG2-5.2.2-Ship_Type_Identification_Recommendations.pdf

    const fieldList = []
    data.find('.vehicleinfo ul').each((index, element) => {
      const fields = []
      $(element).find('li').each((i, el) => {
        if (i !== 10) {
          const val = $(el).find('span').text()
          fields.push(val)
        } else {
          // We'll treat the owners' field specifically
          const owners = []
          $(el).children('span').each(function () {
            const info = $(this).text().split(/\s{2,}/g)
            const owner = {
              name: info[1],
              socialnumber: info[2].replace('(kt. ', '').replace('-', '').replace(')', ''),
              share: parseIsFloat(info[3].replace(' eign', '')) / 100,
            }
            owners.push(owner)
          })
          fields.push(owners)
        }
      })
      if (fields.length > 0) {
        fieldList.push(fields)
      }
    })


    if (fieldList.length > 0 && fieldList[0].length > 0) {
      resolve(fieldList.map(fields => {
        const type = typeDict[fields[1]] ? typeDict[fields[1]] : fields[1]
        const registrationStatus = fields[5] === 'Skráð' ? 'Listed' : 'Unlisted'
        return {
          name: fields[0],
          type,
          registrationNumber: fields[2],
          regionalCode: fields[3].replace(/(\(.*\))/g, '').match(/(\S.*)/g).join(' '),
          homePort: fields[4],
          registrationStatus,
          grossRegisterTonnage: parseIsFloat(fields[6]),
          grossTonnage: parseIsFloat(fields[7]),
          length: parseIsFloat(fields[8]),
          buildYear: parseInt(fields[9].split('af')[0], 10),
          buildYard: fields[9].split('af')[1].match(/(\S.*)/g).join(' '),
          owners: fields[10],
        }
      }))
    } else {
      reject(`No ship found with the name ${name}`)
    }
  })
})

app.get('/ship', (req, res) => {
  const search = req.query.search || ''

  if (!search) {
    return res.status(431).json({ error: 'Please provide a valid search string to lookup' })
  }

  lookupShip(search)
    .then(ships => res.cache().json({ results: ships }))
    .catch(error => res.status(500).json({ error }))
})

export default lookupShip
