function mockResponse() {
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
  resSend.mockImplementation(() => new Promise(function(s) { s(res) }))
  resHeader.mockImplementation(() => res)
  resAttachment.mockImplementation(() => res)
  return res;
}

const mockAgencies = {
  GSA: 'General Services Administration',
  DOD: 'Department of Defense',
  ARMY: 'DEPT OF THE ARMY',
  HHS: 'HEALTH AND HUMAN SERVICES, DEPARTMENT OF',
  USSS: 'US SECRET SERVICE'  // Added USSS agency
};

const mockRoles = {
  ADMIN: 'Administrator',
  COORDINATOR: 'Section 508 Coordinator'
};

module.exports = {
  mockRequest: function(data, headers, params = {}, session = {}) {
    return {
      body: data,
      params: params,
      get: jest.fn(function(x) { return headers[x] }),
      session: Object.assign(session || {}, { destroy: () => {} }),
      headers: headers,
      query: params
    }
  },
  mockResponse: mockResponse,
  
  // Standard user types
  mockAdminUser: { 
    agency: mockAgencies.GSA, 
    userRole: mockRoles.ADMIN 
  },
  mockDoDUser: { 
    agency: mockAgencies.DOD, 
    userRole: mockRoles.ADMIN 
  },
  mockArmyUser: { 
    agency: mockAgencies.ARMY, 
    email: 'test@army.mil',
    userRole: mockRoles.COORDINATOR 
  },
  mockHHSUser: {
    agency: mockAgencies.HHS,
    email: 'test@hhs.gov',
    userRole: mockRoles.COORDINATOR
  },
  mockUSSSUser: {  // Added USSS user
    agency: mockAgencies.USSS,
    email: 'test@usss.dhs.gov',
    userRole: mockRoles.COORDINATOR
  },
  
  // Constants for reuse
  mockAgencies,
  mockRoles
};