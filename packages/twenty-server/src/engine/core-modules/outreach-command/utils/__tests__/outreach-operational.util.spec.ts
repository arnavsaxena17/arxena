import {
  computeNextSendWindow,
  parseHhMmToMinutes,
} from 'src/engine/core-modules/outreach-command/utils/outreach-throttle.util';
import {
  decidePersonaEnrollment,
  scorePersonaPriority,
} from 'src/engine/core-modules/outreach-command/utils/outreach-persona-priority.util';
import { isCandidatePastQueued } from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';
import { OutreachThrottleService } from 'src/engine/core-modules/outreach-command/services/outreach-throttle.service';

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

  it('honors OUTREACH_DELAY_MS-style override in send window', () => {
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

  it('allows sends inside default Mon–Sat 10:00–20:00 window', () => {
    // 2026-01-06 is Tuesday; 05:00 UTC = 10:30 Asia/Kolkata
    const now = new Date('2026-01-06T05:00:00.000Z');
    const result = computeNextSendWindow({
      now,
      timezone: 'Asia/Kolkata',
      sendWindowStart: '10:00',
      sendWindowEnd: '20:00',
      sendWindowDays: '1,2,3,4,5,6',
    });

    expect(result.canSendNow).toBe(true);
    expect(result.delayMs).toBe(0);
  });

  it('defers Monday early morning to Monday 10:00 window', () => {
    // 2026-01-05 is Monday; 03:30 UTC = 09:00 Asia/Kolkata
    const now = new Date('2026-01-05T03:30:00.000Z');
    const result = computeNextSendWindow({
      now,
      timezone: 'Asia/Kolkata',
      sendWindowStart: '10:00',
      sendWindowEnd: '20:00',
      sendWindowDays: '1,2,3,4,5,6',
    });

    expect(result.canSendNow).toBe(false);
    expect(result.delayMs).toBeGreaterThan(0);
    // Next window opens Mon 10:00 IST = 04:30 UTC
    expect(result.nextSendAt.toISOString()).toBe('2026-01-05T04:30:00.000Z');
  });

  it('defers Sunday morning to Monday window', () => {
    // 2026-01-11 is Sunday; 14:00 UTC = 09:00 America/New_York (EST)
    const now = new Date('2026-01-11T14:00:00.000Z');
    const result = computeNextSendWindow({
      now,
      timezone: 'America/New_York',
      sendWindowStart: '10:00',
      sendWindowEnd: '20:00',
      sendWindowDays: '1,2,3,4,5,6',
    });

    expect(result.canSendNow).toBe(false);
    expect(result.delayMs).toBeGreaterThan(0);
    // Next Mon 10:00 EST = 15:00 UTC
    expect(result.nextSendAt.getUTCDay()).toBe(1); // Monday
  });

  it('respects Europe/London daytime window', () => {
    // 2026-01-07 is Wednesday; 11:00 UTC = 11:00 Europe/London (GMT in Jan)
    const inside = computeNextSendWindow({
      now: new Date('2026-01-07T11:00:00.000Z'),
      timezone: 'Europe/London',
      sendWindowStart: '10:00',
      sendWindowEnd: '20:00',
      sendWindowDays: '1,2,3,4,5,6',
    });

    expect(inside.canSendNow).toBe(true);

    const outside = computeNextSendWindow({
      now: new Date('2026-01-07T21:00:00.000Z'),
      timezone: 'Europe/London',
      sendWindowStart: '10:00',
      sendWindowEnd: '20:00',
      sendWindowDays: '1,2,3,4,5,6',
    });

    expect(outside.canSendNow).toBe(false);
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

describe('OutreachThrottleService send window', () => {
  const service = new OutreachThrottleService();

  it('defers connect when outside send window', () => {
    // Sunday 09:00 IST — outside Mon–Sat default days
    const result = service.checkAndReserve({
      counters: {},
      channel: 'connect',
      linkedinConnected: true,
      now: new Date('2026-01-04T03:30:00.000Z'),
      sendWindow: {
        timezone: 'Asia/Kolkata',
        sendWindowStart: '10:00',
        sendWindowEnd: '20:00',
        sendWindowDays: '1,2,3,4,5,6',
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_send_window');
    expect(result.delayMs).toBeGreaterThan(0);
  });

  it('allows connect inside send window', () => {
    // Tuesday 10:30 IST
    const result = service.checkAndReserve({
      counters: {},
      channel: 'connect',
      linkedinConnected: true,
      now: new Date('2026-01-06T05:00:00.000Z'),
      sendWindow: {
        timezone: 'Asia/Kolkata',
        sendWindowStart: '10:00',
        sendWindowEnd: '20:00',
        sendWindowDays: '1,2,3,4,5,6',
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.delayMs).toBe(0);
  });

  it('skips send window for non-connect channels', () => {
    // Sunday — would be outside window for connect
    const result = service.checkAndReserve({
      counters: {},
      channel: 'message',
      linkedinConnected: true,
      now: new Date('2026-01-04T03:30:00.000Z'),
      sendWindow: {
        timezone: 'Asia/Kolkata',
        sendWindowStart: '10:00',
        sendWindowEnd: '20:00',
        sendWindowDays: '1,2,3,4,5,6',
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('blocks sends when project outreachStatus is PAUSED without Bull delay', () => {
    const result = service.checkAndReserve({
      counters: {},
      channel: 'connect',
      linkedinConnected: true,
      outreachStatus: 'PAUSED',
      now: new Date('2026-01-06T05:00:00.000Z'),
      sendWindow: {
        timezone: 'Asia/Kolkata',
        sendWindowStart: '10:00',
        sendWindowEnd: '20:00',
        sendWindowDays: '1,2,3,4,5,6',
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('paused');
    expect(result.delayMs).toBe(0);
    expect(result.nextSendAt).toBeNull();
  });
});
