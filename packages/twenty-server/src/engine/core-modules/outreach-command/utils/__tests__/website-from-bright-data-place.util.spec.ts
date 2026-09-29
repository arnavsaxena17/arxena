import { websiteFromBrightDataPlace } from 'src/engine/core-modules/outreach-command/utils/website-from-bright-data-place.util';

describe('websiteFromBrightDataPlace', () => {
  it('prefers top-level website', () => {
    expect(
      websiteFromBrightDataPlace({
        website: 'https://example.com',
        business_details: [
          {
            field_name: 'authority',
            details: 'ignored.com',
            link: 'http://ignored.com',
          },
        ],
      }),
    ).toBe('https://example.com');
  });

  it('falls back to authority link then details', () => {
    expect(
      websiteFromBrightDataPlace({
        business_details: [
          {
            field_name: 'authority',
            details: 'qsrbrands.com',
            link: 'http://www.qsrbrands.com/',
          },
        ],
      }),
    ).toBe('http://www.qsrbrands.com/');

    expect(
      websiteFromBrightDataPlace({
        business_details: [
          {
            field_name: 'authority',
            details: 'qsrbrands.com',
            link: null,
          },
        ],
      }),
    ).toBe('https://qsrbrands.com');
  });
});
