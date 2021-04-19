
function mockResponse () {
  let resJson = jest.fn()
  let resStatus = jest.fn()
  let resSet = jest.fn()
  let resSend = jest.fn()
  let resHeader = jest.fn()
  let resAttachment = jest.fn()
  let res = {
    set: resSet,
    status: resStatus,
    json: resJson,
    send: resSend,
    header: resHeader,
    attachment: resAttachment
  }
  resJson.mockImplementation(() => res);
  resStatus.mockImplementation(() => res);
  resSet.mockImplementation(() => res);
  resSend.mockImplementation(() => new Promise( function(s) { s(res) }))
  resHeader.mockImplementation(() => res)
  resAttachment.mockImplementation(() => res)
  return res;
}

module.exports = {
  mockRequest : function (data, headers, params = {}, session = {}) {
    return {
      body: data,
      params: params,
      get: jest.fn ( function(x) { return headers[x]}),
      session: Object.assign(session || {}, { destroy: ()=>{} } ),
      headers: headers,
      query: params
    }
  },
  mockResponse : mockResponse,

  mockAdminUser : { agency: 'General Services Administration', userRole: 'Administrator'},
  mockDoDUser : { agency: 'Department of Defense', userRole: 'Administrator'}

}
