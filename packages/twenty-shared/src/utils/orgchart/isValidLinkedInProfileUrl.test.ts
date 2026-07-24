import { isValidLinkedInProfileUrl } from './isValidLinkedInProfileUrl';

describe('isValidLinkedInProfileUrl', () => {
  it('rejects placeholders and empty values', () => {
    expect(isValidLinkedInProfileUrl(undefined)).toBe(false);
    expect(isValidLinkedInProfileUrl('')).toBe(false);
    expect(isValidLinkedInProfileUrl('   ')).toBe(false);
    expect(isValidLinkedInProfileUrl('0')).toBe(false);
    expect(isValidLinkedInProfileUrl('https://')).toBe(false);
    expect(isValidLinkedInProfileUrl('http://')).toBe(false);
  });

  it('accepts /in/ profile URLs', () => {
    expect(
      isValidLinkedInProfileUrl(
        'https://www.linkedin.com/in/rk-kushwaha-b7a15442',
      ),
    ).toBe(true);
    expect(
      isValidLinkedInProfileUrl('linkedin.com/in/someone'),
    ).toBe(true);
  });

  it('rejects company pages', () => {
    expect(
      isValidLinkedInProfileUrl(
        'https://www.linkedin.com/company/batliboi-ltd/',
      ),
    ).toBe(false);
  });

  it('rejects linkedin home path', () => {
    expect(isValidLinkedInProfileUrl('https://www.linkedin.com/')).toBe(
      false,
    );
  });
});
