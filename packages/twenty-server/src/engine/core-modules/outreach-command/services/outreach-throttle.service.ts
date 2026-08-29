import { Injectable } from '@nestjs/common';

import {
  type OutreachThrottleChannel,
  type OutreachThrottleCounters,
  computeNextSendWindow,
  incrementThrottleCounter,
} from 'src/engine/core-modules/outreach-command/utils/outreach-throttle.util';

export type OutreachSendWindowConfig = {
  timezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
};

export type OutreachThrottleCheckInput = {
  counters: OutreachThrottleCounters;
  channel: OutreachThrottleChannel;
  now?: Date;
  linkedinConnected?: boolean;
  gmailConnected?: boolean;
  whatsappConnected?: boolean;
  sendWindow?: OutreachSendWindowConfig | null;
  outreachStatus?: string | null;
};

export type OutreachThrottleCheckResult = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'needs_connection'
    | 'outside_send_window'
    | 'paused'
    | null;
  delayMs: number;
  nextSendAt: Date | null;
  counterPatch: Partial<OutreachThrottleCounters>;
};

export const OUTREACH_PROJECT_PAUSED_PENDING_REASON = 'outreach_project_paused';

const SEND_WINDOW_CHANNELS = new Set<OutreachThrottleChannel>(['connect']);

@Injectable()
export class OutreachThrottleService {
  checkAndReserve(
    input: OutreachThrottleCheckInput,
  ): OutreachThrottleCheckResult {
    const now = input.now ?? new Date();

    if ((input.outreachStatus ?? 'LIVE').toUpperCase() === 'PAUSED') {
      return {
        allowed: false,
        reason: 'paused',
        delayMs: 0,
        nextSendAt: null,
        counterPatch: {},
      };
    }

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

    if (SEND_WINDOW_CHANNELS.has(input.channel) && input.sendWindow) {
      const windowResult = computeNextSendWindow({
        now,
        timezone: input.sendWindow.timezone,
        sendWindowStart: input.sendWindow.sendWindowStart,
        sendWindowEnd: input.sendWindow.sendWindowEnd,
      });

      if (!windowResult.canSendNow) {
        return {
          allowed: false,
          reason: 'outside_send_window',
          delayMs: windowResult.delayMs,
          nextSendAt: windowResult.nextSendAt,
          counterPatch: {},
        };
      }
    }

    return {
      allowed: true,
      reason: 'ok',
      delayMs: 0,
      nextSendAt: now,
      counterPatch: incrementThrottleCounter(
        input.counters,
        input.channel,
        now,
      ),
    };
  }
}
