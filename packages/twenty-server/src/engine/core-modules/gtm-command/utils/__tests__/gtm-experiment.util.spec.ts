import {
  assignGtmExperimentVariant,
  parseGtmExperimentConfig,
  resolveGtmOutboundMessageKind,
} from 'src/engine/core-modules/gtm-command/utils/gtm-experiment.util';

describe('gtm-experiment.util', () => {
  describe('assignGtmExperimentVariant', () => {
    it('is sticky for the same seed', () => {
      const first = assignGtmExperimentVariant({ seed: 'ACoAAA-profile-1' });
      const second = assignGtmExperimentVariant({ seed: 'ACoAAA-profile-1' });

      expect(first).toBe(second);
      expect(['A', 'B']).toContain(first);
    });

    it('splits approximately 50/50 across many seeds', () => {
      let aCount = 0;
      let bCount = 0;

      for (let index = 0; index < 200; index += 1) {
        const variant = assignGtmExperimentVariant({
          seed: `profile-${index}`,
        });

        if (variant === 'A') {
          aCount += 1;
        } else {
          bCount += 1;
        }
      }

      expect(aCount).toBeGreaterThan(60);
      expect(bCount).toBeGreaterThan(60);
      expect(aCount + bCount).toBe(200);
    });
  });

  describe('parseGtmExperimentConfig', () => {
    it('parses running config with default split', () => {
      const parsed = parseGtmExperimentConfig(
        JSON.stringify({ status: 'running' }),
      );

      expect(parsed).toEqual(
        expect.objectContaining({
          status: 'running',
          split: 0.5,
        }),
      );
    });

    it('returns null for invalid JSON', () => {
      expect(parseGtmExperimentConfig('{nope')).toBeNull();
    });
  });

  describe('resolveGtmOutboundMessageKind', () => {
    it('maps connection_sent to CONNECT_NOTE', () => {
      expect(
        resolveGtmOutboundMessageKind({
          materializeEvent: 'connection_sent',
        }),
      ).toBe('CONNECT_NOTE');
    });

    it('maps first LinkedIn message to OPENER', () => {
      expect(
        resolveGtmOutboundMessageKind({
          materializeEvent: 'outbound_message',
          messagingChannel: 'LINKEDIN',
          linkedinFollowUpCount: 0,
        }),
      ).toBe('OPENER');
    });
  });
});
