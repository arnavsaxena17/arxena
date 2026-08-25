export const LINKEDIN_ACCOUNT_RATE_LIMITS_KEY = 'linkedin_account_rate_limits';
export const WHATSAPP_ACCOUNT_RATE_LIMITS_KEY = 'whatsapp_account_rate_limits';

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_FIVE_MINUTES = 5 * MS_PER_MINUTE;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;
export const MS_PER_TWO_SECONDS = 2_000;
export const MS_PER_TEN_SECONDS = 10_000;
export const MS_PER_THIRTY_SECONDS = 30_000;

export type LinkedinAccountRateLimits = {
  endpointPerMinute: number;
  endpointPerDay: number;
  companyProfilePer10Seconds: number;
  profilePer10Seconds: number;
  connectionRequestPer5Minutes: number;
  connectionRequestPerHour: number;
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
  companyProfilePer10Seconds: 1,
  profilePer10Seconds: 1,
  connectionRequestPer5Minutes: 1,
  connectionRequestPerHour: 5,
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
  companyProfilePer10Seconds: { min: 1, max: 3 },
  profilePer10Seconds: { min: 1, max: 3 },
  connectionRequestPer5Minutes: { min: 1, max: 5 },
  connectionRequestPerHour: { min: 1, max: 20 },
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

export type AccountRateLimitUsageWindow = {
  method: string;
  windowName: string;
};

export const ACCOUNT_RATE_LIMIT_WINDOW_MS: Record<string, number> = {
  '2s': MS_PER_TWO_SECONDS,
  '10s': MS_PER_TEN_SECONDS,
  '30s': MS_PER_THIRTY_SECONDS,
  '5m': MS_PER_FIVE_MINUTES,
  minute: MS_PER_MINUTE,
  hour: MS_PER_HOUR,
  day: MS_PER_DAY,
  week: MS_PER_WEEK,
};

export const getAccountRateLimitWindowMs = (
  windowName: string,
): number | undefined => {
  if (
    !Object.prototype.hasOwnProperty.call(
      ACCOUNT_RATE_LIMIT_WINDOW_MS,
      windowName,
    )
  ) {
    return undefined;
  }

  return ACCOUNT_RATE_LIMIT_WINDOW_MS[windowName];
};

export const LINKEDIN_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS: Record<
  keyof LinkedinAccountRateLimits,
  AccountRateLimitUsageWindow
> = {
  endpointPerMinute: { method: 'endpoint', windowName: 'minute' },
  endpointPerDay: { method: 'endpoint', windowName: 'day' },
  companyProfilePer10Seconds: { method: 'company_profile', windowName: '10s' },
  profilePer10Seconds: { method: 'profile', windowName: '10s' },
  connectionRequestPer5Minutes: {
    method: 'connection_request',
    windowName: '5m',
  },
  connectionRequestPerHour: { method: 'connection_request', windowName: 'hour' },
  connectionRequestPerDay: { method: 'connection_request', windowName: 'day' },
  connectionRequestPerWeek: { method: 'connection_request', windowName: 'week' },
  commentPer30Seconds: { method: 'comment', windowName: '30s' },
  commentPerDay: { method: 'comment', windowName: 'day' },
  messagePer30Seconds: { method: 'message', windowName: '30s' },
  messagePerDay: { method: 'message', windowName: 'day' },
  inmailPer30Seconds: { method: 'inmail', windowName: '30s' },
  inmailPerDay: { method: 'inmail', windowName: 'day' },
  searchPerMinute: { method: 'search', windowName: 'minute' },
  searchPerDay: { method: 'search', windowName: 'day' },
};

export const WHATSAPP_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS: Record<
  keyof WhatsappAccountRateLimits,
  AccountRateLimitUsageWindow
> = {
  endpointPerMinute: { method: 'endpoint', windowName: 'minute' },
  endpointPerDay: { method: 'endpoint', windowName: 'day' },
  startChatPerMinute: { method: 'start_chat', windowName: 'minute' },
  startChatPerDay: { method: 'start_chat', windowName: 'day' },
};

export const getLinkedinAccountRateLimitUsageWindow = (
  fieldKey: string,
): AccountRateLimitUsageWindow | undefined => {
  if (
    !Object.prototype.hasOwnProperty.call(
      LINKEDIN_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS,
      fieldKey,
    )
  ) {
    return undefined;
  }

  return LINKEDIN_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS[
    fieldKey as keyof LinkedinAccountRateLimits
  ];
};

export const getWhatsappAccountRateLimitUsageWindow = (
  fieldKey: string,
): AccountRateLimitUsageWindow | undefined => {
  if (
    !Object.prototype.hasOwnProperty.call(
      WHATSAPP_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS,
      fieldKey,
    )
  ) {
    return undefined;
  }

  return WHATSAPP_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS[
    fieldKey as keyof WhatsappAccountRateLimits
  ];
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
  value?:
    | (Partial<LinkedinAccountRateLimits> & {
        profilePer2Seconds?: number;
        companyProfilePer2Seconds?: number;
      })
    | null,
): LinkedinAccountRateLimits => {
  const migrated: Partial<LinkedinAccountRateLimits> = { ...value };

  if (
    migrated.profilePer10Seconds == null &&
    value?.profilePer2Seconds != null
  ) {
    migrated.profilePer10Seconds = value.profilePer2Seconds;
  }

  if (
    migrated.companyProfilePer10Seconds == null &&
    value?.companyProfilePer2Seconds != null
  ) {
    migrated.companyProfilePer10Seconds = value.companyProfilePer2Seconds;
  }

  const result = { ...DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS };

  (Object.keys(DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS) as Array<
    keyof LinkedinAccountRateLimits
  >).forEach((key) => {
    const bounds = LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS[key];
    result[key] = clampInt(
      migrated[key],
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
