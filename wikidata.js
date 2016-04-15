var fs = require('fs')
var path = require('path')
var H = require('highland')
var JSONStream = require('JSONStream')
var request = require('request')
var parse = require('wellknown')

// var sparqlEndpoint = 'https://query.wikidata.org/sparql'
var sparqlEndpoint = 'https://query.wikidata.org/bigdata/namespace/wdq/sparql'

function download (config, dirs, tools, callback) {
  var query = fs.readFileSync(path.join(__dirname, 'query.rq'), 'utf8')
  request({
    url: `${sparqlEndpoint}?query=${encodeURIComponent(query)}`,
    json: true,
    headers: [{
      name: 'accept',
      value: 'application/sparql-results+json'
    }]
  })
  .on('error', (err) => {
    callback(err)
  })
  .on('end', () => {
    callback()
  })
  .pipe(fs.createWriteStream(path.join(dirs.current, 'results.json')))
}

function transform (config, dirs, tools, callback) {
  var stream = fs.createReadStream(path.join(dirs.previous, 'results.json'))
    .pipe(JSONStream.parse('results.bindings.*'))

  H(stream)
    .map((row) => {
      return {
        type: 'pit',
        obj: {
          uri: row.item.value,
          type: 'hg:Building',
          name: row.name.value,
          data: {
            types: JSON.parse(row.type_strings.value)
          },
          geometry: parse(row.point.value)
        }
      }
    })
    .flatten()
    .compact()
    .map(H.curry(tools.writer.writeObject))
    .nfcall([])
    .series()
    .errors(callback)
    .done(callback)
}

// ==================================== API ====================================

module.exports.steps = [
  download,
  transform
]
