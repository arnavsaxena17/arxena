export const LINKEDIN_ACCOUNT_RATE_LIMITS_KEY = 'linkedin_account_rate_limits';
export const WHATSAPP_ACCOUNT_RATE_LIMITS_KEY = 'whatsapp_account_rate_limits';

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;
export const MS_PER_TWO_SECONDS = 2_000;
export const MS_PER_THIRTY_SECONDS = 30_000;

export type LinkedinAccountRateLimits = {
  endpointPerMinute: number;
  endpointPerDay: number;
  companyProfilePer2Seconds: number;
  profilePer2Seconds: number;
  connectionRequestPer30Seconds: number;
  connectionRequestPerDay: number;
  connectionRequestPerWeek: number;
  commentPer30Seconds: number;
  commentPerDay: number;
  messagePer30Seconds: number;
  messagePerDay: number;
  inmailPer30Seconds: number;
  inmailPerDay: number;
  searchPerMinute: number;
  searchPerDay: number;
};

export type WhatsappAccountRateLimits = {
  endpointPerMinute: number;
  endpointPerDay: number;
  startChatPerMinute: number;
  startChatPerDay: number;
};

export type LinkedinAccountRateLimitsMap = Record<
  string,
  LinkedinAccountRateLimits
>;

export type WhatsappAccountRateLimitsMap = Record<
  string,
  WhatsappAccountRateLimits
>;

export const DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS: LinkedinAccountRateLimits = {
  endpointPerMinute: 5,
  endpointPerDay: 40,
  companyProfilePer2Seconds: 1,
  profilePer2Seconds: 1,
  connectionRequestPer30Seconds: 1,
  connectionRequestPerDay: 20,
  connectionRequestPerWeek: 80,
  commentPer30Seconds: 1,
  commentPerDay: 20,
  messagePer30Seconds: 1,
  messagePerDay: 50,
  inmailPer30Seconds: 1,
  inmailPerDay: 20,
  searchPerMinute: 4,
  searchPerDay: 10,
};

export const DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS: WhatsappAccountRateLimits = {
  endpointPerMinute: 5,
  endpointPerDay: 40,
  startChatPerMinute: 2,
  startChatPerDay: 15,
};

export const LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS: Record<
  keyof LinkedinAccountRateLimits,
  { min: number; max: number }
> = {
  endpointPerMinute: { min: 1, max: 10 },
  endpointPerDay: { min: 5, max: 100 },
  companyProfilePer2Seconds: { min: 1, max: 3 },
  profilePer2Seconds: { min: 1, max: 3 },
  connectionRequestPer30Seconds: { min: 1, max: 5 },
  connectionRequestPerDay: { min: 1, max: 50 },
  connectionRequestPerWeek: { min: 5, max: 200 },
  commentPer30Seconds: { min: 1, max: 5 },
  commentPerDay: { min: 1, max: 50 },
  messagePer30Seconds: { min: 1, max: 5 },
  messagePerDay: { min: 1, max: 150 },
  inmailPer30Seconds: { min: 1, max: 5 },
  inmailPerDay: { min: 1, max: 50 },
  searchPerMinute: { min: 1, max: 10 },
  searchPerDay: { min: 1, max: 40 },
};

export const WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS: Record<
  keyof WhatsappAccountRateLimits,
  { min: number; max: number }
> = {
  endpointPerMinute: { min: 1, max: 10 },
  endpointPerDay: { min: 5, max: 100 },
  startChatPerMinute: { min: 1, max: 5 },
  startChatPerDay: { min: 1, max: 30 },
};

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(parsed)));
};

export const sanitizeLinkedinAccountRateLimits = (
  value?: Partial<LinkedinAccountRateLimits> | null,
): LinkedinAccountRateLimits => {
  const result = { ...DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS };

  (Object.keys(DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS) as Array<
    keyof LinkedinAccountRateLimits
  >).forEach((key) => {
    const bounds = LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS[key];
    result[key] = clampInt(
      value?.[key],
      bounds.min,
      bounds.max,
      DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS[key],
    );
  });

  return result;
};

export const sanitizeWhatsappAccountRateLimits = (
  value?: Partial<WhatsappAccountRateLimits> | null,
): WhatsappAccountRateLimits => {
  const result = { ...DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS };

  (Object.keys(DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS) as Array<
    keyof WhatsappAccountRateLimits
  >).forEach((key) => {
    const bounds = WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS[key];
    result[key] = clampInt(
      value?.[key],
      bounds.min,
      bounds.max,
      DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS[key],
    );
  });

  return result;
};

export const parseLinkedinAccountRateLimitsMap = (
  value: unknown,
): LinkedinAccountRateLimitsMap => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([accountId]) => accountId.trim().length > 0)
      .map(([accountId, limits]) => [
        accountId,
        sanitizeLinkedinAccountRateLimits(
          limits as Partial<LinkedinAccountRateLimits>,
        ),
      ]),
  );
};

export const parseWhatsappAccountRateLimitsMap = (
  value: unknown,
): WhatsappAccountRateLimitsMap => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([accountId]) => accountId.trim().length > 0)
      .map(([accountId, limits]) => [
        accountId,
        sanitizeWhatsappAccountRateLimits(
          limits as Partial<WhatsappAccountRateLimits>,
        ),
      ]),
  );
};
