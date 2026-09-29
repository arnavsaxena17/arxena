import {
  buildOutreachMockUnipileConnectionResponseId,
  buildOutreachMockUnipileMessageResponseId,
  buildOutreachMockUnipileVoiceNoteResponseId,
  OUTREACH_MOCK_UNIPILE_CONNECTION_RESPONSE_ID_PREFIX,
  OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID_PREFIX,
  OUTREACH_MOCK_UNIPILE_VOICE_NOTE_RESPONSE_ID_PREFIX,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';

describe('is-outreach-mock-unipile-enabled.util', () => {
  it('builds unique mock message ids so mergeChatTurns keeps each outbound', () => {
    const first = buildOutreachMockUnipileMessageResponseId();
    const second = buildOutreachMockUnipileMessageResponseId();

    expect(first).toMatch(
      new RegExp(`^${OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID_PREFIX}-`),
    );
    expect(second).toMatch(
      new RegExp(`^${OUTREACH_MOCK_UNIPILE_MESSAGE_RESPONSE_ID_PREFIX}-`),
    );
    expect(first).not.toBe(second);
  });

  it('builds unique mock connection and voice-note ids', () => {
    expect(buildOutreachMockUnipileConnectionResponseId()).toMatch(
      new RegExp(`^${OUTREACH_MOCK_UNIPILE_CONNECTION_RESPONSE_ID_PREFIX}-`),
    );
    expect(buildOutreachMockUnipileVoiceNoteResponseId()).toMatch(
      new RegExp(`^${OUTREACH_MOCK_UNIPILE_VOICE_NOTE_RESPONSE_ID_PREFIX}-`),
    );
  });
});
