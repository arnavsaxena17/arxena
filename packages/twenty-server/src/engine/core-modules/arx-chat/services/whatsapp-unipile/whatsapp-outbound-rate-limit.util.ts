export type WhatsappOutboundRateLimitJob = {
  whatsappOutboundMessagesPerMinute?: number;
};

export const toWhatsappOutboundRateLimitJob = (
  job?: unknown,
): WhatsappOutboundRateLimitJob | null | undefined => {
  if (job == null) {
    return job;
  }

  if (typeof job !== 'object') {
    return undefined;
  }

  const { whatsappOutboundMessagesPerMinute } =
    job as WhatsappOutboundRateLimitJob;

  return { whatsappOutboundMessagesPerMinute };
};

export const DEFAULT_WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE = 5;

export const WHATSAPP_OUTBOUND_WINDOW_MS = 60_000;

/** Default random pre-send delay range (ms) to avoid robotic send spacing. */
export const DEFAULT_WHATSAPP_OUTBOUND_JITTER_MIN_MS = 2_000;

export const DEFAULT_WHATSAPP_OUTBOUND_JITTER_MAX_MS = 8_000;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Random delay (ms) before each outbound send; 0 when min and max are both 0. */
export const computeOutboundSendJitterMs = (): number => {
  const minMs = parsePositiveInt(
    process.env.WHATSAPP_OUTBOUND_JITTER_MIN_MS,
    DEFAULT_WHATSAPP_OUTBOUND_JITTER_MIN_MS,
  );
  const maxMs = parsePositiveInt(
    process.env.WHATSAPP_OUTBOUND_JITTER_MAX_MS,
    DEFAULT_WHATSAPP_OUTBOUND_JITTER_MAX_MS,
  );
  const safeMin = Math.min(minMs, maxMs);
  const safeMax = Math.max(minMs, maxMs);

  if (safeMax === 0) {
    return 0;
  }

  return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
};

export const resolveWhatsappOutboundMessagesPerMinute = (
  job?: WhatsappOutboundRateLimitJob | null,
): number => {
  const fromJob = job?.whatsappOutboundMessagesPerMinute;
  if (
    typeof fromJob === 'number' &&
    Number.isFinite(fromJob) &&
    fromJob > 0
  ) {
    return Math.floor(fromJob);
  }

  const fromEnv = parseInt(
    process.env.WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE ??
      String(DEFAULT_WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE),
    10,
  );

  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv);
  }

  return DEFAULT_WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE;
};
