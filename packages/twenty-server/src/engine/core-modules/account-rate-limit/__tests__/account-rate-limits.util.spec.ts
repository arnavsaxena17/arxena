import {
  DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
  DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
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
});
