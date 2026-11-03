import {
  HARVEST_FUNCTION_ID_BY_NAME,
  HARVEST_INDUSTRY_ALIASES,
  HARVEST_INDUSTRY_ID_BY_LABEL,
  HARVEST_SENIORITY_ID_BY_LEVEL,
  TAXONOMY_ROOT_TO_HARVEST_FUNCTION,
  normalizeHarvestFilterLabel,
  resolveHarvestFunctionIdForRoot,
  resolveHarvestIndustryIds,
  resolveHarvestSeniorityLevelIds,
} from '../harvest-filter-ids';

// Labels from LinkedIn's retired industry vocabulary -- the shape account rows
// and older query sets still carry. Some are aliased, some are deliberately not,
// and the point of both is that neither is dropped without a trace.
const LEGACY_LINKEDIN_LABELS = [
  'Hospital & Health Care',
  'Health, Wellness & Fitness',
  'Information Technology & Services',
  'Computer Software',
  'Internet',
  'Marketing & Advertising',
  'Public Relations & Communications',
  'Human Resources',
  'Nonprofit Organization Management',
  'Philanthropy',
  'Public Policy',
  'Oil & Energy',
  'Mining & Metals',
  'Venture Capital & Private Equity',
  'Pharmaceuticals',
  'Biotechnology',
  'Supermarkets',
  'Airports/Airlines',
  'Consumer Goods',
  'Cosmetics',
  'Leisure, Travel & Tourism',
  'Motion Pictures & Film',
  'Museums & Institutions',
];

describe('harvest-filter-ids', () => {
  describe('tables', () => {
    it('covers the 26 documented functions', () => {
      expect(Object.keys(HARVEST_FUNCTION_ID_BY_NAME)).toHaveLength(26);
      expect(HARVEST_FUNCTION_ID_BY_NAME.education).toBe('7');
      expect(HARVEST_FUNCTION_ID_BY_NAME.entrepreneurship).toBe('9');
      expect(HARVEST_FUNCTION_ID_BY_NAME.purchasing).toBe('21');
    });

    it('covers the 10 documented seniority levels', () => {
      expect(Object.keys(HARVEST_SENIORITY_ID_BY_LEVEL)).toHaveLength(10);
      expect(HARVEST_SENIORITY_ID_BY_LEVEL['owner/partner']).toBe('320');
      expect(HARVEST_SENIORITY_ID_BY_LEVEL.in_training).toBe('100');
    });

    it('keeps industry labels unique', () => {
      const ids = Object.values(HARVEST_INDUSTRY_ID_BY_LABEL);

      expect(ids).toHaveLength(434);
      expect(new Set(ids).size).toBe(434);
    });
  });

  // The tables are hand-maintained against vendor data, so the properties that
  // make a lookup exact are asserted rather than assumed: two labels normalizing
  // to one key would shadow one another, and an alias pointing at an id Harvest
  // does not publish would be rejected at run time rather than here.
  describe('table invariants', () => {
    it('keeps industry labels unique after normalization', () => {
      const normalized = Object.keys(HARVEST_INDUSTRY_ID_BY_LABEL).map(
        normalizeHarvestFilterLabel,
      );

      expect(new Set(normalized).size).toBe(normalized.length);
    });

    it('stores every industry label in normalized form', () => {
      const drifted = Object.keys(HARVEST_INDUSTRY_ID_BY_LABEL).filter(
        (label) => normalizeHarvestFilterLabel(label) !== label,
      );

      expect(drifted).toEqual([]);
    });

    it('points every alias at a published industry id', () => {
      const publishedIds = new Set(Object.values(HARVEST_INDUSTRY_ID_BY_LABEL));
      const dangling = Object.entries(HARVEST_INDUSTRY_ALIASES).filter(
        ([, id]) => !publishedIds.has(id),
      );

      expect(dangling).toEqual([]);
    });

    it('keeps alias keys normalized and clear of published labels', () => {
      const aliasKeys = Object.keys(HARVEST_INDUSTRY_ALIASES);
      const unnormalized = aliasKeys.filter(
        (key) => normalizeHarvestFilterLabel(key) !== key,
      );

      expect(unnormalized).toEqual([]);

      // an alias that keyed onto a published label could shadow the vendor row
      const shadowing = aliasKeys.filter(
        (key) => key in HARVEST_INDUSTRY_ID_BY_LABEL,
      );

      expect(shadowing).toEqual([]);
    });

    it('points every taxonomy root at a published function name', () => {
      const dangling = Object.entries(TAXONOMY_ROOT_TO_HARVEST_FUNCTION).filter(
        ([, functionName]) => !(functionName in HARVEST_FUNCTION_ID_BY_NAME),
      );

      expect(dangling).toEqual([]);
    });
  });

  describe('normalizeHarvestFilterLabel', () => {
    it('treats an ampersand as a word rather than gluing it to its neighbours', () => {
      // the old in-place replacement produced "randd" and "manda", which matched
      // no table entry and reported nothing
      expect(normalizeHarvestFilterLabel('R&D')).toBe('r and d');
      expect(normalizeHarvestFilterLabel('M&A')).toBe('m and a');
      expect(normalizeHarvestFilterLabel('Q&A')).toBe('q and a');
    });

    it('folds spacing and case around the ampersand', () => {
      expect(normalizeHarvestFilterLabel('  Hospitals & Health Care ')).toBe(
        'hospitals and health care',
      );
    });

    it('strips diacritics', () => {
      expect(normalizeHarvestFilterLabel('Café Services')).toBe(
        'cafe services',
      );
    });
  });

  describe('resolveHarvestFunctionIdForRoot', () => {
    it('resolves roots to the documented function ids', () => {
      expect(resolveHarvestFunctionIdForRoot('engineering')).toEqual({
        id: '8',
        unresolved: [],
      });
      expect(resolveHarvestFunctionIdForRoot('Education')).toEqual({
        id: '7',
        unresolved: [],
      });
      expect(resolveHarvestFunctionIdForRoot('human resources')).toEqual({
        id: '12',
        unresolved: [],
      });
      expect(resolveHarvestFunctionIdForRoot('information technology')).toEqual(
        {
          id: '13',
          unresolved: [],
        },
      );
    });

    it('reports a root Harvest cannot express instead of dropping it', () => {
      const government = resolveHarvestFunctionIdForRoot('government');
      const supplyChain = resolveHarvestFunctionIdForRoot('supply chain');

      expect(government.id).toBeUndefined();
      expect(government.unresolved).toEqual([
        {
          facet: 'function',
          label: 'government',
          reason: expect.stringContaining('no equivalent'),
        },
      ]);
      expect(supplyChain.id).toBeUndefined();
      expect(supplyChain.unresolved[0]?.reason).toContain('no equivalent');
    });

    it('reports an unrecognised root rather than silently sending nothing', () => {
      const resolution = resolveHarvestFunctionIdForRoot('floristry');

      expect(resolution.id).toBeUndefined();
      expect(resolution.unresolved).toEqual([
        {
          facet: 'function',
          label: 'floristry',
          reason: expect.stringContaining('not a taxonomy function root'),
        },
      ]);
    });

    it('asks for nothing when the root is the any-function sentinel or empty', () => {
      expect(resolveHarvestFunctionIdForRoot('fullcompany')).toEqual({
        unresolved: [],
      });
      expect(resolveHarvestFunctionIdForRoot(undefined)).toEqual({
        unresolved: [],
      });
      expect(resolveHarvestFunctionIdForRoot('')).toEqual({ unresolved: [] });
    });
  });

  describe('resolveHarvestSeniorityLevelIds', () => {
    it('maps every seniority enum to its id', () => {
      expect(
        resolveHarvestSeniorityLevelIds([
          'owner/partner',
          'cxo',
          'vice_president',
          'director',
        ]),
      ).toEqual({ ids: ['320', '310', '300', '220'], unresolved: [] });
    });

    it('deduplicates and tolerates an empty list', () => {
      expect(resolveHarvestSeniorityLevelIds(['senior', 'senior'])).toEqual({
        ids: ['120'],
        unresolved: [],
      });
      expect(resolveHarvestSeniorityLevelIds([])).toEqual({
        ids: [],
        unresolved: [],
      });
      expect(resolveHarvestSeniorityLevelIds(undefined)).toEqual({
        ids: [],
        unresolved: [],
      });
    });

    it('reports a level that is not one of the ten', () => {
      // generated query sets arrive as JSON, so the enum is not enforced
      const resolution = resolveHarvestSeniorityLevelIds([
        'non_senior' as never,
      ]);

      expect(resolution.ids).toEqual([]);
      expect(resolution.unresolved).toEqual([
        {
          facet: 'seniority',
          label: 'non_senior',
          reason: expect.stringContaining('not one of the 10'),
        },
      ]);
    });
  });

  describe('resolveHarvestIndustryIds', () => {
    it('matches published labels case and punctuation insensitively', () => {
      expect(resolveHarvestIndustryIds(['software development']).ids).toEqual([
        '4',
      ]);
      expect(
        resolveHarvestIndustryIds(['IT Services and IT Consulting']).ids,
      ).toEqual(['96']);
      expect(
        resolveHarvestIndustryIds(['  Hospitals & Health Care ']).ids,
      ).toEqual(['14']);
    });

    it('recovers retired LinkedIn labels through the alias table', () => {
      expect(resolveHarvestIndustryIds(['Hospital & Health Care']).ids).toEqual(
        ['14'],
      );
      expect(
        resolveHarvestIndustryIds(['Information Technology & Services']).ids,
      ).toEqual(['96']);
      expect(resolveHarvestIndustryIds(['Computer Software']).ids).toEqual([
        '4',
      ]);
      expect(resolveHarvestIndustryIds(['Pharmaceuticals']).ids).toEqual([
        '15',
      ]);
      expect(
        resolveHarvestIndustryIds(['Venture Capital & Private Equity']).ids,
      ).toEqual(['106']);
      expect(
        resolveHarvestIndustryIds(['Marketing & Advertising']).ids,
      ).toEqual(['1862']);
    });

    it('recovers the entire legacy vocabulary or names what it could not', () => {
      for (const label of LEGACY_LINKEDIN_LABELS) {
        const { ids, unresolved } = resolveHarvestIndustryIds([label]);

        expect(ids.length + unresolved.length).toBe(1);
      }
    });

    it('drops a near miss from the payload and reports it', () => {
      const nearMiss = resolveHarvestIndustryIds(['software']);

      expect(nearMiss.ids).toEqual([]);
      expect(nearMiss.unresolved).toEqual([
        {
          facet: 'industry',
          label: 'software',
          reason: expect.stringContaining('has no alias'),
        },
      ]);
    });

    it('reports a legacy label with no single Harvest counterpart', () => {
      const resolution = resolveHarvestIndustryIds(['Consumer Goods']);

      expect(resolution.ids).toEqual([]);
      expect(resolution.unresolved).toHaveLength(1);
    });

    it('does not repeat the same unresolved label', () => {
      expect(
        resolveHarvestIndustryIds([
          'not a real industry',
          'not a real industry',
        ]).unresolved,
      ).toHaveLength(1);
    });

    it('deduplicates ids across labels that share one Harvest row', () => {
      expect(
        resolveHarvestIndustryIds([
          'Hospitals and Health Care',
          'Hospitals & Health Care',
        ]).ids,
      ).toEqual(['14']);
    });

    it('tolerates an empty list and blank labels', () => {
      expect(resolveHarvestIndustryIds(undefined)).toEqual({
        ids: [],
        unresolved: [],
      });
      expect(resolveHarvestIndustryIds(['', '   '])).toEqual({
        ids: [],
        unresolved: [],
      });
    });
  });
});
