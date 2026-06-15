import { ParameterSanitizer } from './parameter-sanitizer.util';

describe('ParameterSanitizer', () => {
  const sanitizer = new ParameterSanitizer();

  describe('sanitizeSalesNavigatorPeopleSearchRequest', () => {
    it('preserves company when already in include/exclude format with resolved ids', () => {
      const result = sanitizer.sanitizeSalesNavigatorPeopleSearchRequest({
        keywords: 'business OR account OR relationship OR commercial OR client OR key',
        company: {
          include: ['106694021'],
          exclude: null,
        },
      });

      expect(result.company).toEqual({
        include: ['106694021'],
      });
      expect(result.keywords).toBe(
        '(business OR account OR relationship OR commercial OR client OR key)',
      );
    });

    it('converts flat company array to include/exclude format', () => {
      const result = sanitizer.sanitizeSalesNavigatorPeopleSearchRequest({
        keywords: 'sales',
        company: ['106694021', 'invalid', '999'],
      });

      expect(result.company).toEqual({
        include: ['106694021', '999'],
        exclude: [],
      });
    });

    it('preserves both include and exclude company ids', () => {
      const result = sanitizer.sanitizeSalesNavigatorPeopleSearchRequest({
        company: {
          include: ['106694021'],
          exclude: ['12345'],
        },
      });

      expect(result.company).toEqual({
        include: ['106694021'],
        exclude: ['12345'],
      });
    });

    it('drops unresolved company names from include/exclude format', () => {
      const result = sanitizer.sanitizeSalesNavigatorPeopleSearchRequest({
        keywords: 'sales',
        company: {
          include: ['jack & jill'],
          exclude: null,
        },
      });

      expect(result.company).toBeUndefined();
      expect(result.keywords).toBe('sales');
    });
  });

  describe('sanitizeSalesNavigatorCompaniesSearchRequest', () => {
    it('preserves location when already in include/exclude format', () => {
      const result = sanitizer.sanitizeSalesNavigatorCompaniesSearchRequest({
        keywords: 'software',
        location: {
          include: ['103644278'],
          exclude: null,
        },
      });

      expect(result.location).toEqual({
        include: ['103644278'],
      });
    });
  });

  describe('sanitizeClassicPeopleSearchRequest', () => {
    it('keeps company as flat numeric id array', () => {
      const result = sanitizer.sanitizeClassicPeopleSearchRequest({
        keywords: 'engineer',
        company: ['106694021', 'not-an-id'],
      });

      expect(result.company).toEqual(['106694021']);
    });
  });
});
