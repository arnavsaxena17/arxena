import {
  assignOutreachExperimentVariant,
  parseOutreachExperimentConfig,
  resolveOutreachOutboundMessageKind,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';

describe('outreach-experiment.util', () => {
  describe('assignOutreachExperimentVariant', () => {
    it('is sticky for the same seed', () => {
      const first = assignOutreachExperimentVariant({ seed: 'ACoAAA-profile-1' });
      const second = assignOutreachExperimentVariant({ seed: 'ACoAAA-profile-1' });

      expect(first).toBe(second);
      expect(['A', 'B']).toContain(first);
    });

    it('splits approximately 50/50 across many seeds', () => {
      let aCount = 0;
      let bCount = 0;

      for (let index = 0; index < 200; index += 1) {
        const variant = assignOutreachExperimentVariant({
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

  describe('parseOutreachExperimentConfig', () => {
    it('parses running config with default split', () => {
      const parsed = parseOutreachExperimentConfig(
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
      expect(parseOutreachExperimentConfig('{nope')).toBeNull();
    });
  });

  describe('resolveOutreachOutboundMessageKind', () => {
    it('maps connection_sent to CONNECT_NOTE', () => {
      expect(
        resolveOutreachOutboundMessageKind({
          materializeEvent: 'connection_sent',
        }),
      ).toBe('CONNECT_NOTE');
    });

    it('maps first LinkedIn message to OPENER', () => {
      expect(
        resolveOutreachOutboundMessageKind({
          materializeEvent: 'outbound_message',
          messagingChannel: 'LINKEDIN',
          linkedinFollowUpCount: 0,
        }),
      ).toBe('OPENER');
    });
  });
});
