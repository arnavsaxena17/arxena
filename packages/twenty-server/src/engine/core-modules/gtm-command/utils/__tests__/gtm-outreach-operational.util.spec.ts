import {
  computeNextSendWindow,
  parseHhMmToMinutes,
} from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';
import {
  decidePersonaEnrollment,
  scorePersonaPriority,
} from 'src/engine/core-modules/gtm-command/utils/gtm-persona-priority.util';
import { isCandidatePastQueued } from 'src/engine/core-modules/gtm-command/utils/gtm-command-materialize.util';

describe('gtm outreach operational utils', () => {
  it('marks stages past queued for idempotency', () => {
    expect(isCandidatePastQueued('QUEUED')).toBe(false);
    expect(isCandidatePastQueued(null)).toBe(false);
    expect(isCandidatePastQueued('CONNECTION_SENT')).toBe(true);
  });

  it('parses HH:mm', () => {
    expect(parseHhMmToMinutes('09:30')).toBe(9 * 60 + 30);
    expect(parseHhMmToMinutes('bad')).toBeNull();
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
