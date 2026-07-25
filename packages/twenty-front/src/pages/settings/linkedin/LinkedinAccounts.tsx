import { useCallback, useState } from 'react';

import { useApiKeysState } from '@/arx-jd-upload/hooks/useApiKeysState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { LinkedinCookieSyncConsentSetting } from '@/unipile/components/LinkedinCookieSyncConsentSetting';
import { useLingui } from '@lingui/react/macro';
import type { LinkedinSignupCompleteData } from 'twenty-shared/arx';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Mixpanel } from '~/mixpanel';
import { ConnectedLinkedinAccounts } from './components/ConnectedLinkedinAccounts';
import { LinkedinSignup } from './LinkedinSignup';

export const LinkedinAccounts = () => {
  const { t } = useLingui();
  const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
  const bumpLinkedinUnipileUi = useCallback(() => {
    setAccountsRefreshTrigger((n) => n + 1);
  }, []);
  const { updateSpecificApiKey } = useApiKeysState();

  const handleSignupComplete = useCallback(
    async (data: LinkedinSignupCompleteData) => {
      Mixpanel.track('linkedin_connect_complete');
      if (data.accountId) {
        try {
          await updateSpecificApiKey(
            'linkedin_unipile_account_id',
            data.accountId,
          );
          setAccountsRefreshTrigger((n) => n + 1);
        } catch (error) {
          console.error(
            'Failed to save LinkedIn account id to workspace:',
            error,
          );
        }
      }
    },
    [updateSpecificApiKey],
  );

  const handleSignupCancel = (currentStep: string) => {
    console.log('LinkedIn signup cancelled at step:', currentStep);
  };

  const handleSignupError = (error: Error) => {
    console.error('LinkedIn signup error:', error);
  };

  const handleAccountConnected = () => {
    Mixpanel.track('linkedin_connect_complete');
  };

  const handleAccountsLoaded = (_hasConnected: boolean) => {
    // Connected accounts list drives QR / signup visibility internally
  };

  return (
    <SettingsPageLayout
      title={t`LinkedIn Business`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`LinkedIn Business` },
      ]}
    >
      <SettingsPageContainer>
        <LinkedinSignup
          onSignupComplete={handleSignupComplete}
          onSignupError={handleSignupError}
          onSignupCancel={handleSignupCancel}
        />
        <LinkedinCookieSyncConsentSetting
          onLinkedinStoredProfileAction={bumpLinkedinUnipileUi}
        />
        <ConnectedLinkedinAccounts
          refreshTrigger={accountsRefreshTrigger}
          onAccountConnected={handleAccountConnected}
          onAccountsLoaded={handleAccountsLoaded}
        />
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
