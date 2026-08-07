import {
  computeNextSendWindow,
  isOverDailyCap,
  parseHhMmToMinutes,
} from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';
import {
  decidePersonaEnrollment,
  scorePersonaPriority,
} from 'src/engine/core-modules/gtm-command/utils/gtm-persona-priority.util';
import {
  isCandidatePastQueued,
  isPersonGloballyStopped,
  shouldBlockOutboundForCandidate,
} from 'src/engine/core-modules/gtm-command/utils/gtm-command-materialize.util';

describe('gtm outreach operational utils', () => {
  it('detects person global stops', () => {
    expect(isPersonGloballyStopped({ doNotContact: true })).toBe(true);
    expect(
      isPersonGloballyStopped({
        unsubscribedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(isPersonGloballyStopped({ bounceCount: 2 })).toBe(true);
    expect(isPersonGloballyStopped({ bounceCount: 1 })).toBe(false);
  });

  it('blocks outbound on reply / ooo / person stop', () => {
    expect(
      shouldBlockOutboundForCandidate({
        outreachSequenceStage: 'REPLIED',
      }).reason,
    ).toBe('stop_on_reply');
    expect(
      shouldBlockOutboundForCandidate({
        outreachSequenceStage: 'QUEUED',
        oooUntil: '2099-01-01T00:00:00.000Z',
        nowIso: '2026-01-01T00:00:00.000Z',
      }).reason,
    ).toBe('ooo');
    expect(
      shouldBlockOutboundForCandidate({
        outreachSequenceStage: 'QUEUED',
        doNotContact: true,
      }).blocked,
    ).toBe(true);
    expect(
      shouldBlockOutboundForCandidate({
        outreachSequenceStage: 'QUEUED',
      }).blocked,
    ).toBe(false);
  });

  it('marks stages past queued for idempotency', () => {
    expect(isCandidatePastQueued('QUEUED')).toBe(false);
    expect(isCandidatePastQueued(null)).toBe(false);
    expect(isCandidatePastQueued('CONNECTION_SENT')).toBe(true);
  });

  it('parses HH:mm and daily caps', () => {
    expect(parseHhMmToMinutes('09:30')).toBe(9 * 60 + 30);
    expect(parseHhMmToMinutes('bad')).toBeNull();
    expect(
      isOverDailyCap(
        {
          linkedinConnectsToday: 25,
          commentsToday: 0,
          emailsToday: 0,
          maxConnectsPerDay: 25,
          maxCommentsPerDay: 20,
          maxEmailsPerDay: 50,
        },
        'connect',
      ),
    ).toBe(true);
  });

  it('honors GTM_DELAY_MS-style override in send window', () => {
    const now = new Date('2026-01-06T12:00:00.000Z'); // Tuesday
    const immediate = computeNextSendWindow({
      now,
      delayMsOverride: 0,
    });

    expect(immediate.canSendNow).toBe(true);

    const delayed = computeNextSendWindow({
      now,
      delayMsOverride: 5000,
    });

    expect(delayed.canSendNow).toBe(false);
    expect(delayed.delayMs).toBe(5000);
  });

  it('scores and caps personas per company', () => {
    const score = scorePersonaPriority({
      connectionDegree: 1,
      hasWarmPath: true,
      stdFunctionMatch: true,
      stdGradeMatch: true,
      titleSeniorityScore: 1,
    });

    expect(score).toBeGreaterThan(90);

    const decisions = decidePersonaEnrollment({
      maxPersonasPerCompany: 2,
      personas: [
        { id: 'a', score: 10 },
        { id: 'b', score: 90 },
        { id: 'c', score: 50 },
      ],
    });

    expect(decisions.get('b')?.stage).toBe('QUEUED');
    expect(decisions.get('c')?.stage).toBe('QUEUED');
    expect(decisions.get('a')?.stage).toBe('DEFERRED');
  });
});
