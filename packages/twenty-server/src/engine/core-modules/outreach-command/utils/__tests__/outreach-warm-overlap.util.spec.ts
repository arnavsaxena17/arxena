import {
  extractWarmProfileFacts,
  pickWarmWinner,
  scoreWarmOverlap,
  warmNamesMatch,
} from 'src/engine/core-modules/outreach-command/utils/outreach-warm-overlap.util';

const emptyFacts = { schools: [], currentCompanies: [], pastCompanies: [] };

describe('outreach warm overlap util', () => {
  describe('warmNamesMatch', () => {
    it('should match names that differ only by corporate suffix and case', () => {
      expect(warmNamesMatch('Acme Inc.', 'ACME')).toBe(true);
    });

    it('should match a longer name that contains the other as whole words', () => {
      expect(warmNamesMatch('Stanford University', 'Stanford')).toBe(true);
    });

    it('should not match short names as substrings of longer ones', () => {
      expect(warmNamesMatch('Meta', 'Metacore Games')).toBe(false);
      expect(warmNamesMatch('EY', 'Beyond Yield')).toBe(false);
    });

    it('should still match identical short names', () => {
      expect(warmNamesMatch('Meta', 'meta')).toBe(true);
    });
  });

  describe('extractWarmProfileFacts', () => {
    it('should split current and past employers and read schools', () => {
      const facts = extractWarmProfileFacts({
        education: [{ school: 'IIT Bombay' }, { school_name: 'LSE' }],
        work_experience: [
          { company: 'Acme', end: '' },
          { company: 'Globex', end: '2019-01' },
        ],
      });

      expect(facts.schools).toEqual(['IIT Bombay', 'LSE']);
      expect(facts.currentCompanies).toEqual(['Acme']);
      expect(facts.pastCompanies).toEqual(['Globex']);
    });

    it('should return empty facts for a missing profile', () => {
      expect(extractWarmProfileFacts(null)).toEqual(emptyFacts);
    });
  });

  describe('scoreWarmOverlap', () => {
    it('should rank more mutuals and shared school above fewer', () => {
      const prospect = {
        schools: ['IIT Bombay'],
        currentCompanies: ['Initech'],
        pastCompanies: [],
      };
      const strong = scoreWarmOverlap({
        memberId: 'a',
        viewerFacts: { sharedConnectionsCount: 20, networkDistance: 'DISTANCE_2' },
        memberFacts: { ...emptyFacts, schools: ['IIT Bombay'] },
        prospectFacts: prospect,
      });
      const weak = scoreWarmOverlap({
        memberId: 'b',
        viewerFacts: { sharedConnectionsCount: 5, networkDistance: 'DISTANCE_2' },
        memberFacts: emptyFacts,
        prospectFacts: prospect,
      });

      expect(strong.score).toBeGreaterThan(weak.score);
      expect(strong.reasons).toContain('1 shared school');
    });

    it('should cap mutual connections', () => {
      const result = scoreWarmOverlap({
        memberId: 'a',
        viewerFacts: { sharedConnectionsCount: 5000, networkDistance: '' },
        memberFacts: emptyFacts,
        prospectFacts: emptyFacts,
      });

      expect(result.score).toBe(60);
    });

    it('should give a large bonus for an existing first degree connection', () => {
      const result = scoreWarmOverlap({
        memberId: 'a',
        viewerFacts: { sharedConnectionsCount: 0, networkDistance: 'FIRST_DEGREE' },
        memberFacts: emptyFacts,
        prospectFacts: emptyFacts,
      });

      expect(result.score).toBe(100);
      expect(result.reasons).toContain('already connected');
    });
  });

  describe('pickWarmWinner', () => {
    it('should pick the highest score', () => {
      expect(
        pickWarmWinner({
          scores: [
            { memberId: 'a', score: 10, reasons: [] },
            { memberId: 'b', score: 30, reasons: [] },
          ],
          loadByMemberId: {},
          recruiterId: null,
        }),
      ).toBe('b');
    });

    it('should break a tie on lighter load before recruiter or id', () => {
      expect(
        pickWarmWinner({
          scores: [
            { memberId: 'a', score: 0, reasons: [] },
            { memberId: 'b', score: 0, reasons: [] },
          ],
          loadByMemberId: { a: 5, b: 1 },
          recruiterId: 'a',
        }),
      ).toBe('b');
    });

    it('should ignore members whose profile could not be fetched', () => {
      expect(
        pickWarmWinner({
          scores: [
            { memberId: 'a', score: 0, reasons: [], error: 'rate_limited' },
            { memberId: 'b', score: 0, reasons: [] },
          ],
          loadByMemberId: {},
          recruiterId: null,
        }),
      ).toBe('b');
    });

    it('should return null when no seat could be scored', () => {
      expect(
        pickWarmWinner({
          scores: [{ memberId: 'a', score: 0, reasons: [], error: 'x' }],
          loadByMemberId: {},
          recruiterId: null,
        }),
      ).toBeNull();
    });
  });
});
