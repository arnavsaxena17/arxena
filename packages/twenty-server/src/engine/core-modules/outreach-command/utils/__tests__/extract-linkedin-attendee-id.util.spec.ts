import {
  isValidLinkedInProviderId,
  pickLinkedinAttendeeIdFromUnipileProfile,
} from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-attendee-id.util';

describe('isValidLinkedInProviderId', () => {
  it('accepts ACoAA provider ids', () => {
    expect(isValidLinkedInProviderId('ACoAAabcdefghij1234567890')).toBe(true);
  });

  it('rejects public identifiers and URLs', () => {
    expect(isValidLinkedInProviderId('jane-doe')).toBe(false);
    expect(
      isValidLinkedInProviderId('https://www.linkedin.com/in/jane-doe'),
    ).toBe(false);
    expect(isValidLinkedInProviderId('ACoAA123')).toBe(false);
  });
});

describe('pickLinkedinAttendeeIdFromUnipileProfile', () => {
  it('prefers provider_id over public_identifier', () => {
    expect(
      pickLinkedinAttendeeIdFromUnipileProfile({
        provider_id: 'ACoAAabcdefghij1234567890',
        public_identifier: 'jane-doe',
      }),
    ).toBe('ACoAAabcdefghij1234567890');
  });

  it('falls back to public_identifier', () => {
    expect(
      pickLinkedinAttendeeIdFromUnipileProfile({
        public_identifier: 'jane-doe',
      }),
    ).toBe('jane-doe');
  });
});
