import {
  extractOrgChartCompanyMetadataFromPayload,
  mergeOrgChartCompanyField,
  needsOrgChartCompanyInfoLookup,
  normalizeOptionalCompanyField,
} from '../org-chart-company-metadata';

describe('org-chart-company-metadata', () => {
  describe('normalizeOptionalCompanyField', () => {
    it('returns undefined for empty or whitespace strings', () => {
      expect(normalizeOptionalCompanyField('')).toBeUndefined();
      expect(normalizeOptionalCompanyField('   ')).toBeUndefined();
      expect(normalizeOptionalCompanyField(undefined)).toBeUndefined();
    });

    it('returns trimmed non-empty strings', () => {
      expect(normalizeOptionalCompanyField(' litify.com ')).toBe('litify.com');
    });
  });

  describe('mergeOrgChartCompanyField', () => {
    it('uses fallback when SSR value is empty', () => {
      expect(mergeOrgChartCompanyField('', 'litify.com')).toBe('litify.com');
      expect(mergeOrgChartCompanyField(undefined, 'litify.com')).toBe(
        'litify.com',
      );
    });

    it('prefers SSR when present', () => {
      expect(mergeOrgChartCompanyField('arxena.com', 'litify.com')).toBe(
        'arxena.com',
      );
    });
  });

  describe('needsOrgChartCompanyInfoLookup', () => {
    it('is true when any header field is missing', () => {
      expect(
        needsOrgChartCompanyInfoLookup({
          website: 'litify.com',
          linkedinUrl: 'https://linkedin.com/company/litify',
          locationName: 'New York',
        }),
      ).toBe(true);
    });

    it('is false when all header fields are present', () => {
      expect(
        needsOrgChartCompanyInfoLookup({
          website: 'litify.com',
          linkedinUrl: 'https://linkedin.com/company/litify',
          locationName: 'New York',
          industry: 'Software',
        }),
      ).toBe(false);
    });
  });

  describe('extractOrgChartCompanyMetadataFromPayload', () => {
    it('drops empty strings from published org chart payloads', () => {
      expect(
        extractOrgChartCompanyMetadataFromPayload({
          job_company_website: '',
          job_company_linkedin_url: '',
          industry: '',
          location_name: 'New York',
          profile_count: 157,
        }),
      ).toEqual({
        website: undefined,
        linkedinUrl: undefined,
        industry: undefined,
        locationName: 'New York',
        profileCount: 157,
      });
    });
  });
});
