import {
  normalizeIcpSpec,
  renameBuyerTitlesKeyInIcpSpecJson,
  resolveEffectiveIcpSpec,
} from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';

describe('outreach-icp-spec.util', () => {
  describe('normalizeIcpSpec', () => {
    it('reads targetTitles from the new key', () => {
      expect(
        normalizeIcpSpec({
          targetTitles: ['VP People'],
          locations: ['US'],
        }),
      ).toEqual({
        targetTitles: ['VP People'],
        locations: ['US'],
      });
    });

    it('falls back to buyerTitles for legacy JSON', () => {
      expect(
        normalizeIcpSpec({
          buyerTitles: ['Head of Talent'],
          locations: ['India'],
        }),
      ).toEqual({
        targetTitles: ['Head of Talent'],
        locations: ['India'],
      });
    });

    it('prefers targetTitles when both keys are present', () => {
      expect(
        normalizeIcpSpec({
          buyerTitles: ['Legacy Title'],
          targetTitles: ['Current Title'],
          locations: ['UK'],
        }),
      ).toEqual({
        targetTitles: ['Current Title'],
        locations: ['UK'],
      });
    });
  });

  describe('resolveEffectiveIcpSpec', () => {
    const senderProfile = {
      targetTitles: ['CFO', 'VP Finance'],
      locations: ['India'],
    };

    it('uses the sender profile when the project has no override', () => {
      expect(
        resolveEffectiveIcpSpec({ projectIcpSpec: null, senderProfile }),
      ).toEqual({ icpSpec: senderProfile, source: 'sender-profile' });
    });

    it('prefers the project override', () => {
      const projectIcpSpec = JSON.stringify({
        targetTitles: ['CRO'],
        locations: ['US'],
      });

      expect(
        resolveEffectiveIcpSpec({ projectIcpSpec, senderProfile }),
      ).toEqual({
        icpSpec: { targetTitles: ['CRO'], locations: ['US'] },
        source: 'project',
      });
    });

    it('inherits each missing field from the sender profile', () => {
      const projectIcpSpec = JSON.stringify({ locations: ['UK'] });

      expect(
        resolveEffectiveIcpSpec({ projectIcpSpec, senderProfile }),
      ).toEqual({
        icpSpec: { targetTitles: ['CFO', 'VP Finance'], locations: ['UK'] },
        source: 'project',
      });
    });

    it('returns none when neither level has values', () => {
      expect(
        resolveEffectiveIcpSpec({ projectIcpSpec: '', senderProfile: null }),
      ).toEqual({
        icpSpec: { targetTitles: [], locations: [] },
        source: 'none',
      });
    });
  });

  describe('renameBuyerTitlesKeyInIcpSpecJson', () => {
    it('renames buyerTitles and preserves other keys', () => {
      const raw = JSON.stringify({
        name: 'Mid-market people leaders',
        buyerTitles: ['VP People'],
        locations: ['US'],
      });

      const { next, changed } = renameBuyerTitlesKeyInIcpSpecJson(raw);

      expect(changed).toBe(true);
      expect(JSON.parse(next)).toEqual({
        name: 'Mid-market people leaders',
        targetTitles: ['VP People'],
        locations: ['US'],
      });
    });

    it('keeps existing targetTitles when both keys are present', () => {
      const raw = JSON.stringify({
        buyerTitles: ['Legacy Title'],
        targetTitles: ['Current Title'],
      });

      const { next, changed } = renameBuyerTitlesKeyInIcpSpecJson(raw);

      expect(changed).toBe(true);
      expect(JSON.parse(next)).toEqual({
        targetTitles: ['Current Title'],
      });
    });

    it('no-ops when buyerTitles is absent', () => {
      const raw = JSON.stringify({
        targetTitles: ['VP People'],
        locations: ['US'],
      });

      const { next, changed } = renameBuyerTitlesKeyInIcpSpecJson(raw);

      expect(changed).toBe(false);
      expect(next).toBe(raw);
    });
  });
});
