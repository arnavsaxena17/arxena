import {
  canonicalizeLinkedinProfileUrl,
  extractLinkedinProfileId,
} from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';

describe('extractLinkedinProfileId', () => {
  it('extracts public identifier from a profile URL', () => {
    expect(
      extractLinkedinProfileId('https://www.linkedin.com/in/jane-doe/'),
    ).toBe('jane-doe');
  });

  it('extracts from a URL without www', () => {
    expect(extractLinkedinProfileId('https://linkedin.com/in/muizesmail')).toBe(
      'muizesmail',
    );
  });

  it('extracts from a scheme-less profile URL', () => {
    expect(extractLinkedinProfileId('linkedin.com/in/jane-doe')).toBe(
      'jane-doe',
    );
  });

  it('passes through an already-normalized id', () => {
    expect(extractLinkedinProfileId('ACoAAA123')).toBe('ACoAAA123');
  });

  it('returns empty for unrelated URLs', () => {
    expect(extractLinkedinProfileId('https://example.com/jane')).toBe('');
  });

  it('extracts from a Links composite object', () => {
    expect(
      extractLinkedinProfileId({
        __typename: 'Links',
        primaryLinkUrl: 'https://linkedin.com/in/muizesmail',
        primaryLinkLabel: 'https://linkedin.com/in/muizesmail',
      }),
    ).toBe('muizesmail');
  });

  it('prefers linkedinProfileId on a candidate-shaped object', () => {
    expect(
      extractLinkedinProfileId({
        linkedinProfileId: 'jane-doe',
        linkedinUrl: {
          primaryLinkUrl: 'https://www.linkedin.com/in/other-person',
        },
      }),
    ).toBe('jane-doe');
  });

  it('extracts from Person linkedinLink', () => {
    expect(
      extractLinkedinProfileId({
        linkedinLink: {
          primaryLinkUrl: 'https://www.linkedin.com/in/moe-ismail',
        },
      }),
    ).toBe('moe-ismail');
  });

  it('extracts from a JSON-encoded Links object', () => {
    expect(
      extractLinkedinProfileId(
        JSON.stringify({
          primaryLinkUrl: 'https://www.linkedin.com/in/jane-doe',
        }),
      ),
    ).toBe('jane-doe');
  });

  it('extracts a Sales Navigator lead identifier', () => {
    expect(
      extractLinkedinProfileId(
        'https://www.linkedin.com/sales/lead/ACwAABcd123,NAME_SEARCH',
      ),
    ).toBe('ACwAABcd123');
  });

  it('decodes percent-encoded Unicode slugs to NFC', () => {
    expect(
      extractLinkedinProfileId('https://linkedin.com/in/%D9%90%D9%90amz'),
    ).toBe('ِِamz');
    expect(extractLinkedinProfileId('https://linkedin.com/in/ِِamz/')).toBe(
      'ِِamz',
    );
  });

  it('canonicalizes LinkedIn profile URLs to decoded form', () => {
    expect(
      canonicalizeLinkedinProfileUrl(
        'https://www.linkedin.com/in/%D9%90%D9%90amz/',
      ),
    ).toBe('https://linkedin.com/in/ِِamz');
    expect(canonicalizeLinkedinProfileUrl('satyanadella')).toBe(
      'https://linkedin.com/in/satyanadella',
    );
  });
});
