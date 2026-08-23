import { Injectable } from '@nestjs/common';

import {
  type GtmThrottleChannel,
  type GtmThrottleCounters,
  incrementThrottleCounter,
} from 'src/engine/core-modules/gtm-command/utils/gtm-outreach-throttle.util';

export type GtmOutreachThrottleCheckInput = {
  counters: GtmThrottleCounters;
  channel: GtmThrottleChannel;
  now?: Date;
  linkedinConnected?: boolean;
  gmailConnected?: boolean;
  whatsappConnected?: boolean;
};

export type GtmOutreachThrottleCheckResult = {
  allowed: boolean;
  reason: 'ok' | 'needs_connection' | null;
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
