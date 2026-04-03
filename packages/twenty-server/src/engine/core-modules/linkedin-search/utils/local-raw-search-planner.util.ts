import { Logger } from '@nestjs/common';

import {
    LinkedInClassicPeopleSearchRequest,
    LinkedInRawClassicPeopleSearchRequest,
} from '../types/linkedin-search-request.type';
import { RawSearchRequestBuilder } from './raw-search-request-builder.util';
import { VoyagerPeopleSearchGraphqlBuilder } from './voyager-people-search-graphql.util';

export interface LocalLinkedInSessionIdentity {
  accountId: string;
  accessToken: string;
  provider: 'LINKEDIN';
  ip: string;
  userAgent: string;
}

export interface LocalLinkedInPacingPolicy {
  minDelayMs: number;
  maxDelayMs: number;
  burstSize: number;
  cooldownMs: number;
}

export interface LocalLinkedInRetryPolicy {
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  retryOnStatuses: number[];
}

export interface LocalLinkedInRiskPolicy {
  perAccountDailyLimit: number;
  perAccountHourlyLimit: number;
  concurrentRequests: number;
  backoffOnChallenge: boolean;
  warmSessionRequired: boolean;
}

export interface LocalLinkedInChallengeSignals {
  checkpointDetected: boolean;
  loginRedirectDetected: boolean;
  throttled: boolean;
}

export interface LocalLinkedInExecutionPolicy {
  pacing: LocalLinkedInPacingPolicy;
  retry: LocalLinkedInRetryPolicy;
  risk: LocalLinkedInRiskPolicy;
}

export interface PlannedLinkedInRawSearch {
  queryName: string;
  request: LinkedInRawClassicPeopleSearchRequest;
  /** GET /voyager/api/graphql — same search intent as `request`, for local/browser-style calls */
  voyagerGraphqlUrl: string;
  session: {
    accountId: string;
    provider: 'LINKEDIN';
    ip: string;
    userAgent: string;
    accessTokenPreview: string;
  };
  headers: Record<string, string>;
  scheduling: {
    earliestDispatchDelayMs: number;
    recommendedJitterMs: number;
    cooldownAfterBurstMs: number;
  };
  operationalPolicy: LocalLinkedInExecutionPolicy;
  challengeHandling: {
    signals: LocalLinkedInChallengeSignals;
    actions: string[];
  };
  notes: string[];
}

export class LocalRawSearchPlanner {
  private static readonly logger = new Logger(LocalRawSearchPlanner.name);

  static readonly DEFAULT_POLICY: LocalLinkedInExecutionPolicy = {
    pacing: {
      minDelayMs: 2_500,
      maxDelayMs: 8_000,
      burstSize: 3,
      cooldownMs: 45_000,
    },
    retry: {
      maxRetries: 3,
      baseBackoffMs: 15_000,
      maxBackoffMs: 5 * 60_000,
      retryOnStatuses: [429, 500, 502, 503, 504],
    },
    risk: {
      perAccountDailyLimit: 20,
      perAccountHourlyLimit: 6,
      concurrentRequests: 1,
      backoffOnChallenge: true,
      warmSessionRequired: true,
    },
  };

  static planPeopleClassicSearch(
    queryName: string,
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    session: LocalLinkedInSessionIdentity,
    options: {
      start?: number;
      limit?: number;
      policy?: Partial<LocalLinkedInExecutionPolicy>;
      challengeSignals?: Partial<LocalLinkedInChallengeSignals>;
    } = {},
  ): PlannedLinkedInRawSearch {
    const policy = this.mergePolicy(options.policy);
    const challengeSignals: LocalLinkedInChallengeSignals = {
      checkpointDetected: false,
      loginRedirectDetected: false,
      throttled: false,
      ...options.challengeSignals,
    };
    const request = RawSearchRequestBuilder.buildRawRequest(
      params,
      session.accountId,
      {
        start: options.start,
        limit: options.limit,
      },
    );
    const voyagerGraphqlUrl = VoyagerPeopleSearchGraphqlBuilder.buildGraphqlUrl(params, {
      start: options.start,
    });

    const notes = this.buildNotes(params, policy, challengeSignals);
    const challengeActions = this.buildChallengeActions(challengeSignals, policy);
    const plan: PlannedLinkedInRawSearch = {
      queryName,
      request,
      voyagerGraphqlUrl,
      session: {
        accountId: session.accountId,
        provider: session.provider,
        ip: session.ip,
        userAgent: session.userAgent,
        accessTokenPreview: this.maskAccessToken(session.accessToken),
      },
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': session.userAgent,
        'x-session-ip': session.ip,
        authorization: `Bearer ${this.maskAccessToken(session.accessToken)}`,
      },
      scheduling: {
        earliestDispatchDelayMs: policy.pacing.minDelayMs,
        recommendedJitterMs: policy.pacing.maxDelayMs - policy.pacing.minDelayMs,
        cooldownAfterBurstMs: policy.pacing.cooldownMs,
      },
      operationalPolicy: policy,
      challengeHandling: {
        signals: challengeSignals,
        actions: challengeActions,
      },
      notes,
    };

    this.logger.log(
      `Planned local LinkedIn raw search "${queryName}" for account ${session.accountId}`,
    );

    return plan;
  }

  private static mergePolicy(
    policy: Partial<LocalLinkedInExecutionPolicy> | undefined,
  ): LocalLinkedInExecutionPolicy {
    return {
      pacing: {
        ...this.DEFAULT_POLICY.pacing,
        ...(policy?.pacing ?? {}),
      },
      retry: {
        ...this.DEFAULT_POLICY.retry,
        ...(policy?.retry ?? {}),
      },
      risk: {
        ...this.DEFAULT_POLICY.risk,
        ...(policy?.risk ?? {}),
      },
    };
  }

  private static buildNotes(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    policy: LocalLinkedInExecutionPolicy,
    challengeSignals: LocalLinkedInChallengeSignals,
  ): string[] {
    const notes: string[] = [
      'Plan maintains a single account session identity and serialized execution.',
      `Pacing window is ${policy.pacing.minDelayMs}-${policy.pacing.maxDelayMs}ms with burst size ${policy.pacing.burstSize}.`,
      `Retry policy uses exponential backoff starting at ${policy.retry.baseBackoffMs}ms.`,
      `Risk budget is ${policy.risk.perAccountHourlyLimit} requests/hour and ${policy.risk.perAccountDailyLimit} requests/day.`,
    ];

    if (params.advanced_keywords?.company) {
      notes.push(
        `Query uses free-text company filter "${params.advanced_keywords.company}" instead of a resolved company id.`,
      );
    }

    if (params.advanced_keywords?.first_name || params.advanced_keywords?.last_name) {
      notes.push('Query uses first/last-name memory filters for tighter candidate matching.');
    }

    if (challengeSignals.checkpointDetected || challengeSignals.loginRedirectDetected) {
      notes.push('Challenge signals are present; dispatcher should pause and require session repair.');
    }

    return notes;
  }

  private static buildChallengeActions(
    challengeSignals: LocalLinkedInChallengeSignals,
    policy: LocalLinkedInExecutionPolicy,
  ): string[] {
    const actions = [
      'Serialize requests per account.',
      'Refresh persisted cookie/token jar after successful responses.',
      'Record latency, status, and challenge markers for every execution attempt.',
    ];

    if (challengeSignals.throttled) {
      actions.push(
        `Apply exponential backoff up to ${policy.retry.maxBackoffMs}ms before retry.`,
      );
    }

    if (challengeSignals.checkpointDetected || challengeSignals.loginRedirectDetected) {
      actions.push('Mark session unhealthy and stop dispatching new queries.');
      actions.push('Escalate to manual re-auth or session bootstrap refresh.');
    }

    return actions;
  }

  private static maskAccessToken(accessToken: string): string {
    if (accessToken.length <= 12) {
      return accessToken;
    }

    return `${accessToken.slice(0, 6)}...${accessToken.slice(-6)}`;
  }
}
