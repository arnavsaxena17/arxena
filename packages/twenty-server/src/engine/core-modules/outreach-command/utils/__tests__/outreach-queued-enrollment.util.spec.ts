import {
  buildOutreachQueuedCreateFields,
  inferOutreachEnrollmentStageFromLinkedin,
  isOutreachSourcingEnrollment,
} from 'src/engine/core-modules/outreach-command/utils/outreach-queued-enrollment.util';

describe('isOutreachSourcingEnrollment', () => {
  it('matches GTM upload origin', () => {
    expect(
      isOutreachSourcingEnrollment('gtm-workflow-upload-profiles', {
        name: 'Harvest',
      }),
    ).toBe(true);
  });

  it('matches GTM project names', () => {
    expect(
      isOutreachSourcingEnrollment('linkedin_search', { name: 'GTM Harvest' }),
    ).toBe(true);
  });

  it('matches projects with an icpSpec', () => {
    expect(
      isOutreachSourcingEnrollment('linkedin_search', {
        name: 'Harvest',
        icpSpec: '{}',
      }),
    ).toBe(true);
  });

  it('does not match unrelated sourcing', () => {
    expect(
      isOutreachSourcingEnrollment('spreadsheet_import', {
        name: 'Backend Hire',
      }),
    ).toBe(false);
  });
});

describe('inferOutreachEnrollmentStageFromLinkedin', () => {
  it('maps pending_invitation to CONNECTION_SENT', () => {
    expect(
      inferOutreachEnrollmentStageFromLinkedin({
        pending_invitation: true,
        network_distance: 'DISTANCE_3',
      }),
    ).toBe('CONNECTION_SENT');
  });

  it('maps ACCEPT_INVITATION to CONNECTION_ACCEPTED', () => {
    expect(
      inferOutreachEnrollmentStageFromLinkedin({
        pendingInvitation: false,
        lastOutreachActivity: { type: 'ACCEPT_INVITATION' },
      }),
    ).toBe('CONNECTION_ACCEPTED');
  });

  it('maps DISTANCE_1 to CONNECTION_ACCEPTED', () => {
    expect(
      inferOutreachEnrollmentStageFromLinkedin({
        networkDistance: 'DISTANCE_1',
      }),
    ).toBe('CONNECTION_ACCEPTED');
  });

  it('prefers pending invitation over DISTANCE_1', () => {
    expect(
      inferOutreachEnrollmentStageFromLinkedin({
        pendingInvitation: true,
        networkDistance: 'DISTANCE_1',
      }),
    ).toBe('CONNECTION_SENT');
  });

  it('defaults to QUEUED', () => {
    expect(
      inferOutreachEnrollmentStageFromLinkedin({
        networkDistance: 'DISTANCE_3',
        pendingInvitation: false,
      }),
    ).toBe('QUEUED');
  });
});

describe('buildOutreachQueuedCreateFields', () => {
  it('sets QUEUED without Candidate linkedinProfileId', () => {
    expect(
      buildOutreachQueuedCreateFields({
        linkedinUrl: 'https://www.linkedin.com/in/jane-doe/',
      }),
    ).toEqual({
      outreachSequenceStage: 'QUEUED',
    });
  });

  it('stamps CONNECTION_SENT analytics for pending invitations', () => {
    const result = buildOutreachQueuedCreateFields(
      {
        linkedinUrl: 'https://www.linkedin.com/in/sohail',
        pending_invitation: true,
        last_outreach_activity: {
          type: 'SEND_INVITATION',
          performed_at: '2026-09-15T11:17:53.890Z',
        },
      },
      { nowIso: '2026-09-16T00:00:00.000Z' },
    );

    expect(result.outreachSequenceStage).toBe('CONNECTION_SENT');
    expect(result.outreachAnalytics?.connectionSentAt).toBe(
      '2026-09-15T11:17:53.890Z',
    );
    expect(result.outreachAnalytics?.enrolledAt).toBe(
      '2026-09-16T00:00:00.000Z',
    );
  });

  it('stamps CONNECTION_ACCEPTED analytics for DISTANCE_1', () => {
    const result = buildOutreachQueuedCreateFields(
      {
        linkedinUrl: 'https://www.linkedin.com/in/sam',
        network_distance: 'DISTANCE_1',
        last_outreach_activity: {
          type: 'ACCEPT_INVITATION',
          performed_at: '2026-09-14T17:15:57.681Z',
        },
      },
      { nowIso: '2026-09-16T00:00:00.000Z' },
    );

    expect(result.outreachSequenceStage).toBe('CONNECTION_ACCEPTED');
    expect(result.outreachAnalytics?.connectionAcceptedAt).toBe(
      '2026-09-14T17:15:57.681Z',
    );
    expect(result.outreachAnalytics?.connectionSentAt).toBe(
      '2026-09-14T17:15:57.681Z',
    );
  });
});
