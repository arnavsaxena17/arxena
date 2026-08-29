import { Injectable } from '@nestjs/common';

import {
  type GtmThrottleChannel,
  type GtmThrottleCounters,
  computeNextSendWindow,
  incrementThrottleCounter,
} from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';

export type GtmSendWindowConfig = {
  timezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
};

export type GtmOutreachThrottleCheckInput = {
  counters: GtmThrottleCounters;
  channel: GtmThrottleChannel;
  now?: Date;
  linkedinConnected?: boolean;
  gmailConnected?: boolean;
  whatsappConnected?: boolean;
  sendWindow?: GtmSendWindowConfig | null;
  outreachStatus?: string | null;
};

export type GtmOutreachThrottleCheckResult = {
  allowed: boolean;
  reason:
    | 'ok'
    | 'needs_connection'
    | 'outside_send_window'
    | 'paused'
    | null;
  delayMs: number;
  nextSendAt: Date | null;
  counterPatch: Partial<GtmThrottleCounters>;
};

export const GTM_PROJECT_PAUSED_PENDING_REASON = 'gtm_project_paused';

const SEND_WINDOW_CHANNELS = new Set<GtmThrottleChannel>(['connect']);

@Injectable()
export class GtmOutreachThrottleService {
  checkAndReserve(
    input: GtmOutreachThrottleCheckInput,
  ): GtmOutreachThrottleCheckResult {
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
