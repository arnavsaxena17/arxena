import {
  extractDisplayPictureUrl,
  resolveAvatarUrlFromDisplayPictureUrl,
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
    const result = resolveAvatarUrlFromDisplayPictureUrl(`/avatars/${avatarKey}`);

    expect(result).toBe(`https://app.arxena.com/avatars/${avatarKey}`);
  });

  it('keeps external https URLs unchanged', () => {
    const result = resolveAvatarUrlFromDisplayPictureUrl(
      'https://p.naukri.com/jphoto/abc',
    );

    expect(result).toBe('https://p.naukri.com/jphoto/abc');
  });
});
