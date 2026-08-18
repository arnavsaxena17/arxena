import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';

describe('extractLinkedinProfileId', () => {
  it('extracts public identifier from a profile URL', () => {
    expect(
      extractLinkedinProfileId('https://www.linkedin.com/in/jane-doe/'),
    ).toBe('jane-doe');
  });

  it('passes through an already-normalized id', () => {
    expect(extractLinkedinProfileId('ACoAAA123')).toBe('ACoAAA123');
  });

  it('returns empty for unrelated URLs', () => {
    expect(extractLinkedinProfileId('https://example.com/jane')).toBe('');
  });
});
