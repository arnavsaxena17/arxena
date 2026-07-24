/**
 * Normalizes outbound WhatsApp text so line breaks survive LLM output and API transport.
 */
export const normalizeWhatsAppOutboundMessage = (message: string): string => {
  if (!message) {
    return message;
  }

  return message
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trimEnd();
};
