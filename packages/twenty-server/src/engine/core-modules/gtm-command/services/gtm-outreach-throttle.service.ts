import { Injectable } from '@nestjs/common';

import {
  type GtmThrottleChannel,
  type GtmThrottleCounters,
  computeNextSendWindow,
  computeSeatGapDelayMs,
  incrementThrottleCounter,
  isOverDailyCap,
  isOverWeeklyConnectCap,
} from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';

export type GtmOutreachThrottleCheckInput = {
  counters: GtmThrottleCounters;
  channel: GtmThrottleChannel;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  now?: Date;
  linkedinConnected?: boolean;
  gmailConnected?: boolean;
  whatsappConnected?: boolean;
};

export type GtmOutreachThrottleCheckResult = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'needs_connection'
    | 'over_daily_cap'
    | 'over_weekly_cap'
    | 'seat_gap'
    | 'outside_send_window'
    | null;
  delayMs: number;
  nextSendAt: Date | null;
  counterPatch: Partial<GtmThrottleCounters>;
};

@Injectable()
export class GtmOutreachThrottleService {
  checkAndReserve(
    input: GtmOutreachThrottleCheckInput,
  ): GtmOutreachThrottleCheckResult {
    const now = input.now ?? new Date();
    const delayMsOverride = process.env.GTM_DELAY_MS
      ? Number(process.env.GTM_DELAY_MS)
      : null;

    const needsLinkedIn =
      input.channel === 'connect' || input.channel === 'comment';
    const needsGmail = input.channel === 'email';

    if (needsLinkedIn && input.linkedinConnected === false) {
      return {
        allowed: false,
        reason: 'needs_connection',
        delayMs: 0,
        nextSendAt: null,
        counterPatch: {},
      };
    }

    if (needsGmail && input.gmailConnected === false) {
      return {
        allowed: false,
        reason: 'needs_connection',
        delayMs: 0,
        nextSendAt: null,
        counterPatch: {},
      };
    }

    if (isOverDailyCap(input.counters, input.channel)) {
      const window = computeNextSendWindow({
        now,
        timezone: input.sendTimezone,
        sendWindowStart: input.sendWindowStart,
        sendWindowEnd: input.sendWindowEnd,
        delayMsOverride:
          delayMsOverride !== null && Number.isFinite(delayMsOverride)
            ? delayMsOverride
            : 60 * 60 * 1000,
      });

      return {
        allowed: false,
        reason: 'over_daily_cap',
        delayMs: window.delayMs,
        nextSendAt: window.nextSendAt,
        counterPatch: {},
      };
    }

    if (input.channel === 'connect') {
      const weekly = isOverWeeklyConnectCap(input.counters, now);

      if (weekly.over) {
        const nextWeek = new Date(weekly.weekStartedAt.getTime());

        nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);

        return {
          allowed: false,
          reason: 'over_weekly_cap',
          delayMs: Math.max(0, nextWeek.getTime() - now.getTime()),
          nextSendAt: nextWeek,
          counterPatch: {},
        };
      }
    }

    const gapMs = computeSeatGapDelayMs({
      channel: input.channel,
      counters: input.counters,
      now,
    });

    if (gapMs > 0) {
      return {
        allowed: false,
        reason: 'seat_gap',
        delayMs: gapMs,
        nextSendAt: new Date(now.getTime() + gapMs),
        counterPatch: {},
      };
    }

    const window = computeNextSendWindow({
      now,
      timezone: input.sendTimezone,
      sendWindowStart: input.sendWindowStart,
      sendWindowEnd: input.sendWindowEnd,
      delayMsOverride:
        delayMsOverride !== null && Number.isFinite(delayMsOverride)
          ? 0
          : null,
    });

    if (!window.canSendNow) {
      return {
        allowed: false,
        reason: 'outside_send_window',
        delayMs: window.delayMs,
        nextSendAt: window.nextSendAt,
        counterPatch: {},
      };
    }

    return {
      allowed: true,
      reason: 'ok',
      delayMs: 0,
      nextSendAt: now,
      counterPatch: incrementThrottleCounter(input.counters, input.channel, now),
    };
  }
}
