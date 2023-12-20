function jsonToURI(json){ return encodeURIComponent(JSON.stringify(json)); }

function uriToJSON(urijson){ return JSON.parse(decodeURIComponent(urijson)); }


module.exports = {
    jsonToURI: jsonToURI,
    uriToJSON: uriToJSON
}