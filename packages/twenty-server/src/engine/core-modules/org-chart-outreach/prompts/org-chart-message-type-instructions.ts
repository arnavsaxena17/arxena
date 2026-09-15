import {
  type IcpChannelMessageType,
  type OutreachTone,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';

export const ORG_CHART_CONNECTION_REQUEST_MAX_LENGTH = 300;
export const ORG_CHART_INMAIL_SUBJECT_MAX_LENGTH = 200;
export const ORG_CHART_DIRECT_MESSAGE_MAX_LENGTH = 1000;

export const buildOrgChartMessageTypeInstructions = (
  messageType: IcpChannelMessageType,
): string => {
  switch (messageType) {
    case 'connection_request':
      return [
        'Write a LinkedIn connection request note.',
        `Hard limit: message MUST be ${ORG_CHART_CONNECTION_REQUEST_MAX_LENGTH} characters or fewer (including spaces).`,
        'Return JSON: {"message":"..."}',
      ].join('\n');
    case 'inmail':
      return [
        'Write a LinkedIn InMail.',
        `Subject limit: ${ORG_CHART_INMAIL_SUBJECT_MAX_LENGTH} characters. Body: concise, roughly 500-800 characters.`,
        'Return JSON: {"subject":"...","message":"..."}',
      ].join('\n');
    case 'message':
      return [
        'Write a LinkedIn direct message.',
        `Keep the message under ${ORG_CHART_DIRECT_MESSAGE_MAX_LENGTH} characters.`,
        'Return JSON: {"message":"..."}',
      ].join('\n');
    case 'email':
      return [
        'Write a cold outreach email.',
        'Subject: specific and under 80 characters, no clickbait.',
        'Body: plain text, roughly 500-900 characters, 2-3 short paragraphs,',
        'ending with a low-friction ask (e.g. "worth a look?"). No signature block.',
        'Return JSON: {"subject":"...","message":"..."}',
      ].join('\n');
    case 'whatsapp':
      return [
        'Write a short WhatsApp message.',
        'Hard limit: 600 characters. Conversational but professional; no',
        'greeting fluff, no signature, no markdown formatting.',
        'Return JSON: {"message":"..."}',
      ].join('\n');
  }
};

export const buildOrgChartToneGuide = (tone: OutreachTone): string => {
  if (tone === 'warm') {
    return 'Use a warm, personable tone.';
  }

  if (tone === 'direct') {
    return 'Use a direct, concise tone.';
  }

  return 'Use a professional, respectful tone.';
};
