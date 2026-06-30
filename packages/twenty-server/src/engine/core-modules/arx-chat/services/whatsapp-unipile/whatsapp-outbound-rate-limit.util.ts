import { Job } from 'twenty-shared';

export const DEFAULT_WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE = 5;

export const WHATSAPP_OUTBOUND_WINDOW_MS = 60_000;

export const resolveWhatsappOutboundMessagesPerMinute = (
  job?: Job | null,
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
