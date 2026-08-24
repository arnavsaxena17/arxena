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

  return (
    <AccountRateLimitsPanel<LinkedinAccountRateLimits>
      title="Rate limits for this LinkedIn account"
      description="The maximum number of requests in a window of time for this LinkedIn account. People / org chart search counts once per search, not once per paginated Unipile page. Location, company, and industry lookups use the per-endpoint limits instead."
      accountId={accountId}
      loadLimits={loadLimits}
      saveLimits={saveLimits}
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
          key: 'companyProfilePer2Seconds',
          label: 'Get company profile',
          windowLabel: 'per 2 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.companyProfilePer2Seconds,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.companyProfilePer2Seconds,
        },
        {
          key: 'profilePer2Seconds',
          label: 'Get profile',
          windowLabel: 'per 2 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.profilePer2Seconds,
          recommended: DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.profilePer2Seconds,
        },
        {
          key: 'connectionRequestPer30Seconds',
          label: 'Send connection request',
          windowLabel: 'per 30 sec',
          ...LINKEDIN_ACCOUNT_RATE_LIMIT_BOUNDS.connectionRequestPer30Seconds,
          recommended:
            DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.connectionRequestPer30Seconds,
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
