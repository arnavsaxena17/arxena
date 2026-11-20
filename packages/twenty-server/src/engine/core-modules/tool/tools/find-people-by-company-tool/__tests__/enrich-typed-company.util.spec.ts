import { type ResolvedCompanyFromRawName } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import {
  buildTypedCompanyRow,
  isTrustedIndexMatch,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/enrich-typed-company.util';

const indexHit = (
  overrides: Partial<ResolvedCompanyFromRawName> = {},
): ResolvedCompanyFromRawName =>
  ({
    rawCompanyName: 'Kokilaben Dhirubhai Ambani Hospital',
    cleanedQuery: 'kokilaben dhirubhai ambani hospital',
    resolved: true,
    lookupFailed: false,
    name: 'Kokilaben Dhirubhai Ambani Hospital',
    id: 'index-1',
    website: 'https://www.kokilabenhospital.com',
    industry: 'Hospitals and Health Care',
    country: 'IN',
    linkedinUrl: 'https://www.linkedin.com/company/kokilaben-hospital',
    size: '5001-10000',
    founded: '2009',
    matchConfidence: 'high',
    alternates: [],
    ...overrides,
  }) as ResolvedCompanyFromRawName;

describe('isTrustedIndexMatch', () => {
  it('should trust a high-confidence name match', () => {
    expect(isTrustedIndexMatch({ domain: undefined }, indexHit())).toBe(true);
  });

  it('should trust a medium match only when the typed domain agrees', () => {
    const medium = indexHit({ matchConfidence: 'medium' });

    expect(
      isTrustedIndexMatch({ domain: 'kokilabenhospital.com' }, medium),
    ).toBe(true);
    expect(isTrustedIndexMatch({ domain: 'other.com' }, medium)).toBe(false);
    expect(isTrustedIndexMatch({ domain: undefined }, medium)).toBe(false);
  });

  it('should never trust a low match, a miss or a failed lookup', () => {
    expect(
      isTrustedIndexMatch(
        { domain: 'hindujahospital.com' },
        indexHit({ name: 'hinduja tech', matchConfidence: 'low' }),
      ),
    ).toBe(false);
    expect(
      isTrustedIndexMatch({ domain: undefined }, indexHit({ resolved: false })),
    ).toBe(false);
    expect(
      isTrustedIndexMatch(
        { domain: undefined },
        indexHit({ lookupFailed: true }),
      ),
    ).toBe(false);
    expect(isTrustedIndexMatch({ domain: undefined }, null)).toBe(false);
  });
});

describe('buildTypedCompanyRow', () => {
  it('should fill industry, size and LinkedIn from a trusted index match', () => {
    const row = buildTypedCompanyRow(
      {
        name: 'Kokilaben Dhirubhai Ambani Hospital',
        domain: 'kokilabenhospital.com',
      },
      indexHit(),
    );

    expect(row).toEqual(
      expect.objectContaining({
        name: 'Kokilaben Dhirubhai Ambani Hospital',
        domain: 'kokilabenhospital.com',
        industry: 'Hospitals and Health Care',
        employees: '5001-10000',
        otherFields: expect.objectContaining({
          identitySource: 'index',
          indexCompanyId: 'index-1',
          linkedinUrl: 'https://www.linkedin.com/company/kokilaben-hospital',
          country: 'IN',
          indexMatchConfidence: 'high',
        }),
      }),
    );
    expect(row.otherFields).not.toHaveProperty('indexWebsite');
  });

  it('should keep what the model typed over the index', () => {
    const row = buildTypedCompanyRow(
      {
        name: 'Kokilaben Hospital',
        domain: 'kokilabenhospital.com',
        industry: 'Hospital',
        employees: 4000,
      },
      indexHit(),
    );

    expect(row.industry).toBe('Hospital');
    expect(row.employees).toBe('4000');
  });

  it('should keep a typed domain the index disagrees with, and flag it', () => {
    const row = buildTypedCompanyRow(
      {
        name: 'Nanavati Max Super Speciality Hospital',
        domain: 'nanavatimaxhospital.org',
      },
      indexHit({
        name: 'Nanavati Max Super Speciality Hospital',
        website: 'https://www.nanavatimaxhospital.org.in',
      }),
    );

    expect(row.domain).toBe('nanavatimaxhospital.org');
    expect(row.otherFields).toEqual(
      expect.objectContaining({ indexWebsite: 'nanavatimaxhospital.org.in' }),
    );
  });

  it('should take the index website when the model typed no domain', () => {
    const row = buildTypedCompanyRow(
      { name: 'Kokilaben Dhirubhai Ambani Hospital' },
      indexHit(),
    );

    expect(row.domain).toBe('kokilabenhospital.com');
  });

  it('should write the row as typed and mark it unchecked without a trusted match', () => {
    const row = buildTypedCompanyRow(
      {
        name: 'P.D. Hinduja Hospital & MRC',
        domain: 'https://www.hindujahospital.com/',
      },
      indexHit({ name: 'hinduja tech', matchConfidence: 'low' }),
    );

    expect(row).toEqual(
      expect.objectContaining({
        name: 'P.D. Hinduja Hospital & MRC',
        domain: 'hindujahospital.com',
        industry: '',
        employees: '',
        otherFields: { identitySource: 'model' },
      }),
    );
  });
});
