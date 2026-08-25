import { useCallback } from 'react';
import {
  DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
  LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS,
  type LinkedinAccountRateLimits,
} from 'twenty-shared/arx';

import { AccountRateLimitsPanel } from '@/settings/account-rate-limits/components/AccountRateLimitsPanel';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

type LinkedinAccountRateLimitsPanelProps = {
  accountId: string;
  accessToken?: string;
};

export const LinkedinAccountRateLimitsPanel = ({
  accountId,
  accessToken,
}: LinkedinAccountRateLimitsPanelProps) => {
  const loadLimits = useCallback(async () => {
    const service = getLinkedinService();
    return service.getAccountRateLimits(accountId, accessToken);
  }, [accountId, accessToken]);

  const saveLimits = useCallback(
    async (limits: LinkedinAccountRateLimits) => {
      const service = getLinkedinService();
      return service.saveAccountRateLimits(accountId, limits, accessToken);
    },
    [accountId, accessToken],
  );

  const flushUsage = useCallback(
    async (fieldKey: keyof LinkedinAccountRateLimits) => {
      const service = getLinkedinService();
      return service.flushAccountRateLimitUsage(
        accountId,
        fieldKey,
        accessToken,
      );
    },
    [accountId, accessToken],
  );

  return (
    <AccountRateLimitsPanel<LinkedinAccountRateLimits>
      title="Rate limits for this LinkedIn account"
      description="For each request type, the maximum number of requests in the next interval, and how many have been used so far."
      accountId={accountId}
      loadLimits={loadLimits}
      saveLimits={saveLimits}
      flushUsage={flushUsage}
      fields={[
        {
          key: 'endpointPerMinute',
          label: 'Per-endpoint minute limit',
          windowLabel: 'per 1 min',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.endpointPerMinute,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.endpointPerMinute,
        },
        {
          key: 'endpointPerDay',
          label: 'Per-endpoint day limit',
          windowLabel: 'per 1 day',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.endpointPerDay,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.endpointPerDay,
        },
        {
          key: 'companyProfilePer10Seconds',
          label: 'Get company profile',
          windowLabel: 'per 10 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.companyProfilePer10Seconds,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.companyProfilePer10Seconds,
        },
        {
          key: 'profilePer10Seconds',
          label: 'Get profile',
          windowLabel: 'per 10 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.profilePer10Seconds,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.profilePer10Seconds,
        },
        {
          key: 'connectionRequestPer5Minutes',
          label: 'Send connection request',
          windowLabel: 'per 5 min',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.connectionRequestPer5Minutes,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPer5Minutes,
        },
        {
          key: 'connectionRequestPerHour',
          label: 'Send connection request',
          windowLabel: 'per 1 hour',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.connectionRequestPerHour,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPerHour,
        },
        {
          key: 'connectionRequestPerDay',
          label: 'Send connection request',
          windowLabel: 'per 1 day',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.connectionRequestPerDay,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPerDay,
        },
        {
          key: 'connectionRequestPerWeek',
          label: 'Send connection request',
          windowLabel: 'per 1 week',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.connectionRequestPerWeek,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPerWeek,
        },
        {
          key: 'commentPer30Seconds',
          label: 'Post comment',
          windowLabel: 'per 30 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.commentPer30Seconds,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.commentPer30Seconds,
        },
        {
          key: 'commentPerDay',
          label: 'Post comment',
          windowLabel: 'per 1 day',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.commentPerDay,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.commentPerDay,
        },
        {
          key: 'messagePer30Seconds',
          label: 'Send LinkedIn message',
          windowLabel: 'per 30 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.messagePer30Seconds,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.messagePer30Seconds,
        },
        {
          key: 'messagePerDay',
          label: 'Send LinkedIn message',
          windowLabel: 'per 1 day',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.messagePerDay,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.messagePerDay,
        },
        {
          key: 'inmailPer30Seconds',
          label: 'Send LinkedIn InMail',
          windowLabel: 'per 30 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.inmailPer30Seconds,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.inmailPer30Seconds,
        },
        {
          key: 'inmailPerDay',
          label: 'Send LinkedIn InMail',
          windowLabel: 'per 1 day',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.inmailPerDay,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.inmailPerDay,
        },
        {
          key: 'searchPerMinute',
          label: 'People / org chart search',
          windowLabel: 'per 1 min',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.searchPerMinute,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.searchPerMinute,
        },
        {
          key: 'searchPerDay',
          label: 'People / org chart search',
          windowLabel: 'per 1 day',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.searchPerDay,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.searchPerDay,
        },
      ]}
    />
  );
};
