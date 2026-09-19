import {
  extractDisplayPictureUrl,
  readPrimaryLinkUrl,
  resolveAvatarUrlFromDisplayPictureUrl,
  toCrmPrimaryLink,
} from '../avatar-url.util';

describe('avatar-url.util', () => {
  const originalServerBaseUrl = process.env.SERVER_BASE_URL;

  beforeEach(() => {
    process.env.SERVER_BASE_URL = 'https://app.arxena.com';
  });

  afterEach(() => {
    if (originalServerBaseUrl === undefined) {
      delete process.env.SERVER_BASE_URL;
    } else {
      process.env.SERVER_BASE_URL = originalServerBaseUrl;
    }
  });

  it('extracts display picture from links object', () => {
    const url = extractDisplayPictureUrl({
      displayPicture: {
        primaryLinkLabel: 'Display Picture',
        primaryLinkUrl: 'https://p.naukri.com/jphoto/abc',
      },
    });

    expect(url).toBe('https://p.naukri.com/jphoto/abc');
  });

  it('resolves persisted avatar paths to absolute URLs', () => {
    const avatarKey = 'b'.repeat(64);
    const result = resolveAvatarUrlFromDisplayPictureUrl(
      `/avatars/${avatarKey}`,
    );

    expect(result).toBe(`https://app.arxena.com/avatars/${avatarKey}`);
  });

  it('keeps external https URLs unchanged', () => {
    const result = resolveAvatarUrlFromDisplayPictureUrl(
      'https://p.naukri.com/jphoto/abc',
    );

    expect(result).toBe('https://p.naukri.com/jphoto/abc');
  });

  it('converts persisted avatar paths into CRM link metadata', () => {
    const avatarKey = 'b'.repeat(64);
    const link = toCrmPrimaryLink(`/avatars/${avatarKey}`, 'Display Picture');

    expect(link).toEqual({
      primaryLinkLabel: 'Display Picture',
      primaryLinkUrl: `https://app.arxena.com/avatars/${avatarKey}`,
    });
  });

  it('omits non-http values from CRM link metadata', () => {
    expect(toCrmPrimaryLink('not-a-url', 'Display Picture')).toBeUndefined();
  });

  it('treats missing urls as empty instead of throwing', () => {
    expect(resolveAvatarUrlFromDisplayPictureUrl(undefined)).toBe('');
    expect(resolveAvatarUrlFromDisplayPictureUrl(null)).toBe('');
    expect(toCrmPrimaryLink(undefined, 'Hiring Naukri')).toBeUndefined();
    expect(toCrmPrimaryLink(null, 'Resdex Naukri')).toBeUndefined();
  });

  it('reads primaryLinkUrl from string or links object', () => {
    expect(readPrimaryLinkUrl('https://example.com')).toBe(
      'https://example.com',
    );
    expect(
      readPrimaryLinkUrl({ primaryLinkUrl: 'https://naukri.example/x' }),
    ).toBe('https://naukri.example/x');
    expect(readPrimaryLinkUrl(undefined)).toBeUndefined();
    expect(readPrimaryLinkUrl({ primaryLinkUrl: undefined })).toBeUndefined();
  });
});
