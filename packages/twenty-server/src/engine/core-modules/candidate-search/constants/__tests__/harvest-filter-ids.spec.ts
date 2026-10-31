import {
  HARVEST_FUNCTION_ID_BY_NAME,
  HARVEST_INDUSTRY_ID_BY_LABEL,
  HARVEST_SENIORITY_ID_BY_LEVEL,
  resolveHarvestFunctionIdForRoot,
  resolveHarvestIndustryIds,
  resolveHarvestSeniorityLevelIds,
} from '../harvest-filter-ids';

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

  describe('resolveHarvestFunctionIdForRoot', () => {
    it('resolves roots to the documented function ids', () => {
      expect(resolveHarvestFunctionIdForRoot('engineering')).toBe('8');
      expect(resolveHarvestFunctionIdForRoot('Education')).toBe('7');
      expect(resolveHarvestFunctionIdForRoot('human resources')).toBe('12');
      expect(resolveHarvestFunctionIdForRoot('information technology')).toBe(
        '13',
      );
    });

    it('leaves roots with no Harvest counterpart unsent', () => {
      expect(resolveHarvestFunctionIdForRoot('government')).toBeUndefined();
      expect(resolveHarvestFunctionIdForRoot('supply chain')).toBeUndefined();
      expect(resolveHarvestFunctionIdForRoot('fullcompany')).toBeUndefined();
      expect(resolveHarvestFunctionIdForRoot(undefined)).toBeUndefined();
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
      ).toEqual(['320', '310', '300', '220']);
    });

    it('deduplicates and tolerates an empty list', () => {
      expect(resolveHarvestSeniorityLevelIds(['senior', 'senior'])).toEqual([
        '120',
      ]);
      expect(resolveHarvestSeniorityLevelIds([])).toEqual([]);
      expect(resolveHarvestSeniorityLevelIds(undefined)).toEqual([]);
    });
  });

  describe('resolveHarvestIndustryIds', () => {
    it('matches published labels case and punctuation insensitively', () => {
      expect(resolveHarvestIndustryIds(['software development'])).toEqual([
        '4',
      ]);
      expect(resolveHarvestIndustryIds(['IT Services and IT Consulting'])).toEqual(
        ['96'],
      );
      expect(resolveHarvestIndustryIds(['  Hospitals & Health Care '])).toEqual([
        '14',
      ]);
    });

    it('drops near misses instead of widening the search', () => {
      expect(resolveHarvestIndustryIds(['software'])).toEqual([]);
      expect(resolveHarvestIndustryIds(['not a real industry'])).toEqual([]);
    });
  });
});
