import {
  buildCompanyIdentity,
  identityBrandKey,
  identityVariants,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-identity.util';
import { type ResolvedCompanyFromRawName } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';

const resolvedCompany = (
  overrides: Partial<ResolvedCompanyFromRawName> = {},
): ResolvedCompanyFromRawName => ({
  rawCompanyName: 'Jubilant Foodworks Ltd.',
  cleanedQuery: 'jubilant foodworks',
  resolved: true,
  name: 'Jubilant FoodWorks',
  id: 'jubilant-foodworks',
  website: 'https://www.jubilantfoodworks.com/',
  industry: 'Food and Beverage Services',
  country: 'India',
  linkedinUrl: 'https://www.linkedin.com/company/jubilant-foodworks',
  countOrg: 12,
  size: '10001+',
  founded: null,
  corporateScore: null,
  isOrgChart: true,
  editDistance: 0,
  matchConfidence: 'high',
  alternates: [
    {
      name: 'Jubilant FoodWorks Limited',
      website: null,
      linkedinUrl: null,
      size: null,
    },
  ],
  lookupFailed: false,
  durationMs: 1,
  ...overrides,
});

describe('buildCompanyIdentity', () => {
  it('should use the resolved company when the index answered', () => {
    const identity = buildCompanyIdentity({
      target: { name: 'Jubilant Foodworks Ltd.' },
      resolved: resolvedCompany(),
    });

    expect(identity.canonicalName).toBe('Jubilant FoodWorks');
    expect(identity.companyId).toBe('jubilant-foodworks');
    expect(identity.domain).toBe('jubilantfoodworks.com');
    expect(identity.industry).toBe('Food and Beverage Services');
    expect(identity.country).toBe('India');
    expect(identity.linkedinUrl).toBe(
      'https://www.linkedin.com/company/jubilant-foodworks',
    );
    expect(identity.resolved).toBe(true);
    // The caller's spelling stays first: it is what the tab and the user use
    expect(identity.aliases[0]).toBe('Jubilant Foodworks Ltd.');
    expect(identity.aliases).toContain('Jubilant FoodWorks Limited');
  });

  it('should fall back to the caller own fields when the index missed', () => {
    const identity = buildCompanyIdentity({
      target: {
        name: 'Acme Foods',
        alternateNames: ['Acme'],
        domain: 'https://acme.example/',
        industry: 'Packaged Foods',
      },
      resolved: resolvedCompany({
        resolved: false,
        name: null,
        id: null,
        website: null,
        industry: null,
        country: null,
        linkedinUrl: null,
        alternates: [],
      }),
    });

    expect(identity.canonicalName).toBe('Acme Foods');
    expect(identity.resolved).toBe(false);
    expect(identity.domain).toBe('acme.example');
    expect(identity.industry).toBe('Packaged Foods');
    expect(identity.companyId).toBeUndefined();
    expect(identity.aliases).toEqual(['Acme Foods', 'Acme']);
  });

  it('should treat a failed index lookup as unresolved, not as "no such company"', () => {
    const identity = buildCompanyIdentity({
      target: { name: 'Acme Foods' },
      resolved: resolvedCompany({ resolved: false, lookupFailed: true }),
    });

    expect(identity.resolved).toBe(false);
    expect(identity.canonicalName).toBe('Acme Foods');
  });

  it('should keep one brand key however the name is written', () => {
    const withIndex = buildCompanyIdentity({
      target: { name: 'Jubilant Foodworks Ltd.' },
      resolved: resolvedCompany(),
    });
    const withoutIndex = buildCompanyIdentity({
      target: { name: 'Jubilant FoodWorks Ltd.' },
    });

    expect(identityBrandKey(withIndex)).toBe(identityBrandKey(withoutIndex));
  });

  it('should offer the spellings a source may search with', () => {
    const variants = identityVariants(
      buildCompanyIdentity({
        target: { name: 'Jubilant Foodworks Ltd.' },
        resolved: resolvedCompany(),
      }),
    );

    expect(variants).toContain('Jubilant FoodWorks');
    expect(variants.some((variant) => !/ltd/i.test(variant))).toBe(true);
  });
});
