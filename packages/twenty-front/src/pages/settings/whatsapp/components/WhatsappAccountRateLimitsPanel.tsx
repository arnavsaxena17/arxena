import { useCallback } from 'react';
import {
  DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
  WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS,
  type WhatsappAccountRateLimits,
} from 'twenty-shared/arx';

import { AccountRateLimitsPanel } from '@/settings/account-rate-limits/components/AccountRateLimitsPanel';
import { getWhatsappUnipileService } from '~/pages/settings/whatsapp/services/whatsapp-unipile-backend.service';

type WhatsappAccountRateLimitsPanelProps = {
  accountId: string;
  accessToken?: string;
};

export const WhatsappAccountRateLimitsPanel = ({
  accountId,
  accessToken,
}: WhatsappAccountRateLimitsPanelProps) => {
  const loadLimits = useCallback(async () => {
    const service = getWhatsappUnipileService();
    return service.getAccountRateLimits(accountId, accessToken);
  }, [accountId, accessToken]);

  const saveLimits = useCallback(
    async (limits: WhatsappAccountRateLimits) => {
      const service = getWhatsappUnipileService();
      return service.saveAccountRateLimits(accountId, limits, accessToken);
    },
    [accountId, accessToken],
  );

  const flushUsage = useCallback(
    async (fieldKey: keyof WhatsappAccountRateLimits) => {
      const service = getWhatsappUnipileService();
      return service.flushAccountRateLimitUsage(
        accountId,
        fieldKey,
        accessToken,
      );
    },
    [accountId, accessToken],
  );

  return (
    <AccountRateLimitsPanel<WhatsappAccountRateLimits>
      title="Rate limits for this WhatsApp account"
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
          ...WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS.endpointPerMinute,
          recommended: DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS.endpointPerMinute,
        },
        {
          key: 'endpointPerDay',
          label: 'Per-endpoint day limit',
          windowLabel: 'per 1 day',
          ...WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS.endpointPerDay,
          recommended: DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS.endpointPerDay,
        },
        {
          key: 'startChatPerMinute',
          label: 'Start a chat',
          windowLabel: 'per 1 min',
          ...WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS.startChatPerMinute,
          recommended: DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS.startChatPerMinute,
        },
        {
          key: 'startChatPerDay',
          label: 'Start a chat',
          windowLabel: 'per 1 day',
          ...WHATSAPP_ACCOUNT_RATE_LIMIT_BOUNDS.startChatPerDay,
          recommended: DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS.startChatPerDay,
        },
      ]}
    />
  );
};
