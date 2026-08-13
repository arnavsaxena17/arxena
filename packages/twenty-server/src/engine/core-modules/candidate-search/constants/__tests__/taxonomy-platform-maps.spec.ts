import {
  resolveApolloFilters,
  resolveSalesNavFilters,
  resolveSalesNavFunctionIdsForRoot,
} from '../taxonomy-platform-maps';

describe('taxonomy-platform-maps', () => {
  describe('resolveSalesNavFunctionIdsForRoot', () => {
    it('resolves known roots using Harvest-compatible IDs', () => {
      expect(resolveSalesNavFunctionIdsForRoot('engineering')).toBe('8');
      expect(resolveSalesNavFunctionIdsForRoot('Human Resources')).toBe('12');
      expect(resolveSalesNavFunctionIdsForRoot('sales')).toBe('25');
      expect(resolveSalesNavFunctionIdsForRoot('information technology')).toBe(
        '13',
      );
    });

    it('returns undefined for empty or fullcompany', () => {
      expect(resolveSalesNavFunctionIdsForRoot(undefined)).toBeUndefined();
      expect(resolveSalesNavFunctionIdsForRoot('')).toBeUndefined();
      expect(resolveSalesNavFunctionIdsForRoot('fullcompany')).toBeUndefined();
    });
  });

  describe('resolveSalesNavFilters', () => {
    it('maps function root and leadership grade', () => {
      const result = resolveSalesNavFilters({
        functionRoot: 'human resources',
        stdGrade: 'leadership',
      });

      expect(result.functionIds).toEqual(['12']);
      expect(result.seniorities).toEqual(
        expect.arrayContaining(['cxo', 'director', 'vice_president']),
      );
    });

    it('falls back to stdFunction for function ID when root missing', () => {
      const result = resolveSalesNavFilters({
        stdFunction: 'engineering',
        stdGrade: 'entry',
      });

      expect(result.functionIds).toEqual(['8']);
      expect(result.seniorities).toEqual(
        expect.arrayContaining(['entry_level', 'in_training']),
      );
    });

    it('returns empty arrays when unmapped', () => {
      const result = resolveSalesNavFilters({
        functionRoot: 'unknown-root-xyz',
        stdGrade: 'not-a-grade',
      });

      expect(result.functionIds).toEqual([]);
      expect(result.seniorities).toEqual([]);
    });
  });

  describe('resolveApolloFilters', () => {
    it('uses master_* for function root', () => {
      const result = resolveApolloFilters({
        functionRoot: 'human resources',
        stdGrade: 'leadership',
      });

      expect(result.person_department_or_subdepartments).toEqual([
        'master_human_resources',
      ]);
      expect(result.person_seniorities).toEqual(
        expect.arrayContaining(['c_suite', 'vp', 'head', 'director']),
      );
    });

    it('prefers leaf departments when stdFunction is set', () => {
      const result = resolveApolloFilters({
        functionRoot: 'human resources',
        stdFunction: 'hr business partner',
        stdGrade: 'mid',
      });

      expect(result.person_department_or_subdepartments).toEqual([
        'hr_business_partner',
      ]);
      expect(result.person_seniorities).toEqual(
        expect.arrayContaining(['manager', 'senior']),
      );
    });

    it('expands HR root leaf list when searching known std function family', () => {
      const result = resolveApolloFilters({
        stdFunction: 'human resources',
      });

      expect(result.person_department_or_subdepartments).toEqual(
        expect.arrayContaining([
          'human_resources',
          'hr_business_partner',
          'people_operations',
        ]),
      );
    });
  });
});
