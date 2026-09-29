// Message / voice / connection ids become chatMessage turn ids. mergeChatTurns
// dedupes by id, so a fixed mock id drops later outbounds (e.g. reply after opener).
export const OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID_PREFIX =
  'mock-linkedin-message';

export const OUTREACH_MOCK_UNIPILE_VOICE_NOTE_RESPONSE_ID_PREFIX =
  'mock-linkedin-voice-note';

export const OUTREACH_MOCK_UNIPILE_CONNECTION_RESPONSE_ID_PREFIX =
  'mock-linkedin-connection';

export const OUTREACH_MOCK_UNIPILE_INMAIL_RESPONSE_ID_PREFIX =
  'mock-linkedin-inmail';

const uniqueMockId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const buildOutreachMockUnipileMessageResponseId = (): string =>
  uniqueMockId(OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID_PREFIX);

export const buildOutreachMockUnipileVoiceNoteResponseId = (): string =>
  uniqueMockId(OUTREACH_MOCK_UNIPILE_VOICE_NOTE_RESPONSE_ID_PREFIX);

export const buildOutreachMockUnipileConnectionResponseId = (): string =>
  uniqueMockId(OUTREACH_MOCK_UNIPILE_CONNECTION_RESPONSE_ID_PREFIX);

export const buildOutreachMockUnipileInmailResponseId = (): string =>
  uniqueMockId(OUTREACH_MOCK_UNIPILE_INMAIL_RESPONSE_ID_PREFIX);

// Non-transcript mock responses (not merged into messageObj).
export const OUTREACH_MOCK_UNIPILE_POST_COMMENT_RESPONSE_ID =
  'mock-linkedin-post-comment';

export const OUTREACH_MOCK_UNIPILE_PROFILE_VIEW_RESPONSE_ID =
  'mock-linkedin-profile-view';

export const OUTREACH_MOCK_UNIPILE_PROFILE_FOLLOW_RESPONSE_ID =
  'mock-linkedin-profile-follow';

export const OUTREACH_MOCK_UNIPILE_POST_LIKE_RESPONSE_ID =
  'mock-linkedin-post-like';
