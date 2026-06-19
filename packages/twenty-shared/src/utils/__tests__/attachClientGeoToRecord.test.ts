import {
  attachClientGeoToCookieAuth,
  attachClientGeoToLinkedinBody,
} from '../clientGeo/attachClientGeoToRecord';

describe('attachClientGeoToRecord', () => {
  it('attaches linkedin body geo fields when session is present', () => {
    const body = attachClientGeoToLinkedinBody(
      { user_agent: 'Mozilla/5.0' },
      { ip: '203.0.113.10', country: 'US' },
    );

    expect(body).toEqual({
      user_agent: 'Mozilla/5.0',
      client_ip: '203.0.113.10',
      client_country: 'US',
    });
    console.log('[attachClientGeoToRecord.test] linkedin body ok');
  });

  it('attaches cookie auth geo fields when session is present', () => {
    const body = attachClientGeoToCookieAuth(
      { access_token: 'token', user_agent: 'Mozilla/5.0' },
      { ip: '203.0.113.10', country: 'IN' },
    );

    expect(body).toEqual({
      access_token: 'token',
      user_agent: 'Mozilla/5.0',
      ip: '203.0.113.10',
      country: 'IN',
    });
    console.log('[attachClientGeoToRecord.test] cookie auth body ok');
  });
});
