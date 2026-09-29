import {
  getOutreachJourneyTimelineStages,
  shouldIncludeCommentedWarmupInJourneyTimeline,
  shouldIncludeInmailSentInJourneyTimeline,
} from '@/outreach-home/constants/outreach-journey-stages';

describe('outreach-journey-stages', () => {
  it('should omit COMMENTED and INMAIL_SENT from the default connect-first timeline', () => {
    const stageIds = getOutreachJourneyTimelineStages().map(
      (timelineStage) => timelineStage.id,
    );

    expect(stageIds).not.toContain('COMMENTED');
    expect(stageIds).not.toContain('INMAIL_SENT');
    expect(stageIds[0]).toBe('QUEUED');
    expect(stageIds[1]).toBe('CONNECTION_SENT');
  });

  it('should insert COMMENTED between QUEUED and CONNECTION_SENT when warm-up is on', () => {
    const stageIds = getOutreachJourneyTimelineStages({
      includeCommentedWarmup: true,
    }).map((timelineStage) => timelineStage.id);

    expect(stageIds.indexOf('QUEUED')).toBe(0);
    expect(stageIds.indexOf('COMMENTED')).toBe(1);
    expect(stageIds.indexOf('CONNECTION_SENT')).toBe(2);
  });

  it('should insert INMAIL_SENT between CONNECTION_SENT and EMAIL_SENT when InMail is on', () => {
    const stageIds = getOutreachJourneyTimelineStages({
      includeInmailSent: true,
    }).map((timelineStage) => timelineStage.id);

    expect(stageIds.indexOf('CONNECTION_SENT')).toBe(1);
    expect(stageIds.indexOf('INMAIL_SENT')).toBe(2);
    expect(stageIds.indexOf('EMAIL_SENT')).toBe(3);
  });

  it('should include COMMENTED when the sequencer option or CRM history says so', () => {
    expect(
      shouldIncludeCommentedWarmupInJourneyTimeline({
        commentBeforeConnect: true,
      }),
    ).toBe(true);

    expect(
      shouldIncludeCommentedWarmupInJourneyTimeline({
        outreachSequenceStage: 'COMMENTED',
      }),
    ).toBe(true);

    expect(
      shouldIncludeCommentedWarmupInJourneyTimeline({
        stageHistory: [{ stage: 'COMMENTED' }],
      }),
    ).toBe(true);

    expect(
      shouldIncludeCommentedWarmupInJourneyTimeline({
        commentBeforeConnect: false,
        outreachSequenceStage: 'QUEUED',
        stageHistory: [{ stage: 'QUEUED' }],
      }),
    ).toBe(false);
  });

  it('should include INMAIL_SENT when the sequencer option or CRM history says so', () => {
    expect(
      shouldIncludeInmailSentInJourneyTimeline({
        inmailEnabled: true,
      }),
    ).toBe(true);

    expect(
      shouldIncludeInmailSentInJourneyTimeline({
        outreachSequenceStage: 'INMAIL_SENT',
      }),
    ).toBe(true);

    expect(
      shouldIncludeInmailSentInJourneyTimeline({
        stageHistory: [{ stage: 'INMAIL_SENT' }],
      }),
    ).toBe(true);

    expect(
      shouldIncludeInmailSentInJourneyTimeline({
        inmailEnabled: false,
        outreachSequenceStage: 'CONNECTION_SENT',
      }),
    ).toBe(false);
  });
});
