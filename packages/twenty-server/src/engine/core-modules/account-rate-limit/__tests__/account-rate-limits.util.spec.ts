import {
  DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
  DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
  getAccountRateLimitWindowMs,
  getLinkedinAccountRateLimitUsageWindow,
  getWhatsappAccountRateLimitUsageWindow,
  parseLinkedinAccountRateLimitsMap,
  sanitizeLinkedinAccountRateLimits,
  sanitizeWhatsappAccountRateLimits,
} from 'twenty-shared/arx';

describe('account rate limit sanitization', () => {
  it('fills missing LinkedIn fields with conservative defaults', () => {
    expect(sanitizeLinkedinAccountRateLimits({})).toEqual(
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
    );
  });

  it('clamps LinkedIn connection weekly cap to the allowed range', () => {
    expect(
      sanitizeLinkedinAccountRateLimits({
        connectionRequestPerWeek: 999,
      }).connectionRequestPerWeek,
    ).toBe(200);
  });

  it('clamps LinkedIn connection hourly cap to the allowed range', () => {
    expect(
      sanitizeLinkedinAccountRateLimits({
        connectionRequestPerHour: 999,
      }).connectionRequestPerHour,
    ).toBe(20);
    expect(DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPerHour).toBe(
      5,
    );
    expect(
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPer5Minutes,
    ).toBe(1);
  });

  it('migrates saved Get profile and company profile 2s limits onto the 10s window', () => {
    const migrated = sanitizeLinkedinAccountRateLimits({
      profilePer2Seconds: 2,
      companyProfilePer2Seconds: 2,
    });

    expect(migrated.profilePer10Seconds).toBe(2);
    expect(migrated.companyProfilePer10Seconds).toBe(2);
    expect(DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.profilePer10Seconds).toBe(1);
    expect(DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.companyProfilePer10Seconds).toBe(
      1,
    );
  });

  it('parses a per-account LinkedIn map', () => {
    const map = parseLinkedinAccountRateLimitsMap({
      acc_1: { connectionRequestPerDay: 10 },
    });

    expect(map.acc_1.connectionRequestPerDay).toBe(10);
    expect(map.acc_1.searchPerDay).toBe(
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.searchPerDay,
    );
    expect(map.acc_1.commentPerDay).toBe(
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.commentPerDay,
    );
    expect(map.acc_1.messagePerDay).toBe(
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.messagePerDay,
    );
    expect(map.acc_1.inmailPerDay).toBe(
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.inmailPerDay,
    );
  });

  it('uses conservative WhatsApp start-chat defaults', () => {
    expect(sanitizeWhatsappAccountRateLimits(undefined)).toEqual(
      DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
    );
    expect(DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS.startChatPerMinute).toBe(2);
    expect(DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS.startChatPerDay).toBe(15);
  });

  it('maps LinkedIn and WhatsApp field keys to Redis usage windows', () => {
    expect(
      getLinkedinAccountRateLimitUsageWindow('connectionRequestPer5Minutes'),
    ).toEqual({
      method: 'connection_request',
      windowName: '5m',
    });
    expect(getLinkedinAccountRateLimitUsageWindow('searchPerDay')).toEqual({
      method: 'search',
      windowName: 'day',
    });
    expect(
      getLinkedinAccountRateLimitUsageWindow('profilePer10Seconds'),
    ).toEqual({
      method: 'profile',
      windowName: '10s',
    });
    expect(
      getLinkedinAccountRateLimitUsageWindow('companyProfilePer10Seconds'),
    ).toEqual({
      method: 'company_profile',
      windowName: '10s',
    });
    expect(getLinkedinAccountRateLimitUsageWindow('toString')).toBeUndefined();
    expect(
      getWhatsappAccountRateLimitUsageWindow('startChatPerMinute'),
    ).toEqual({
      method: 'start_chat',
      windowName: 'minute',
    });
    expect(getWhatsappAccountRateLimitUsageWindow('unknown')).toBeUndefined();
  });

  it('maps window names to sliding-window durations', () => {
    expect(getAccountRateLimitWindowMs('5m')).toBe(300_000);
    expect(getAccountRateLimitWindowMs('10s')).toBe(10_000);
    expect(getAccountRateLimitWindowMs('hour')).toBe(3_600_000);
    expect(getAccountRateLimitWindowMs('week')).toBe(604_800_000);
    expect(getAccountRateLimitWindowMs('unknown')).toBeUndefined();
  });
});
