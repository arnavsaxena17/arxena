import { isMatchingRawJsonFilter } from '@/utils/filter/utils/isMatchingRawJsonFilter';

describe('isMatchingRawJsonFilter', () => {
  describe('like', () => {
    it('should match using wildcard pattern', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { like: '%test%' },
          value: 'some test value',
        }),
      ).toBe(true);
    });

    it('should not match when pattern does not match', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { like: '%xyz%' },
          value: 'some test value',
        }),
      ).toBe(false);
    });
  });

  describe('is', () => {
    it('should match NULL check', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { is: 'NULL' },
          value: null as any,
        }),
      ).toBe(true);
    });

    it('should match NOT_NULL check', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { is: 'NOT_NULL' },
          value: '{"key": "val"}',
        }),
      ).toBe(true);
    });
  });

  describe('path', () => {
    it('should match eq on nested key', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { path: 'timeToFirstContactBucket', eq: 'D1_3' },
          value: { timeToFirstContactBucket: 'D1_3', daysToFirstContact: 2 },
        }),
      ).toBe(true);
    });

    it('should match isEmpty on missing nested key', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { path: 'meetingBookedAt', isEmpty: true },
          value: { daysToFirstContact: 2 },
        }),
      ).toBe(true);
    });

    it('should match numeric gt on nested key', () => {
      expect(
        isMatchingRawJsonFilter({
          rawJsonFilter: { path: 'daysToFirstContact', gt: 1 },
          value: { daysToFirstContact: 3 },
        }),
      ).toBe(true);
    });
  });

  describe('default', () => {
    it('should throw for unexpected filter', () => {
      expect(() =>
        isMatchingRawJsonFilter({
          rawJsonFilter: {} as any,
          value: 'test',
        }),
      ).toThrow('Unexpected value for RAW_JSON filter');
    });
  });
});
