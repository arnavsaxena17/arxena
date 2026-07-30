import { useCallback, useState } from 'react';

import { useApiKeysState } from '@/arx-jd-upload/hooks/useApiKeysState';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { LinkedinCookieSyncConsentSetting } from '@/unipile/components/LinkedinCookieSyncConsentSetting';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import type { LinkedinSignupCompleteData } from 'twenty-shared/arx';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { Mixpanel } from '~/mixpanel';
import { ConnectedLinkedinAccounts } from './components/ConnectedLinkedinAccounts';
import { LinkedinSignup } from './LinkedinSignup';

const AddAnotherAccountRow = styled.div`
  display: flex;
  justify-content: flex-start;
  margin: 0.5rem 0 1rem;
`;

export const LinkedinAccounts = () => {
  const { t } = useLingui();
  const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
  const [accountsLoadSettled, setAccountsLoadSettled] = useState(false);
  const [hasConnectedAccounts, setHasConnectedAccounts] = useState(false);
  const [isAddingAnotherAccount, setIsAddingAnotherAccount] = useState(false);
  const bumpLinkedinUnipileUi = useCallback(() => {
    setAccountsRefreshTrigger((n) => n + 1);
  }, []);
  const { updateSpecificApiKey } = useApiKeysState();

  const handleSignupComplete = useCallback(
    async (data: LinkedinSignupCompleteData) => {
      Mixpanel.track('linkedin_connect_complete');
      setIsAddingAnotherAccount(false);
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
    setIsAddingAnotherAccount(false);
  };

  const handleSignupError = (error: Error) => {
    console.error('LinkedIn signup error:', error);
  };

  const handleAccountConnected = () => {
    Mixpanel.track('linkedin_connect_complete');
  };

  const handleAccountsLoaded = useCallback((hasConnected: boolean) => {
    setHasConnectedAccounts(hasConnected);
    setAccountsLoadSettled(true);
    if (!hasConnected) {
      setIsAddingAnotherAccount(false);
    }
  }, []);

  const shouldShowSignupForm =
    accountsLoadSettled &&
    (!hasConnectedAccounts || isAddingAnotherAccount);

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
        {accountsLoadSettled &&
          hasConnectedAccounts &&
          !isAddingAnotherAccount && (
            <AddAnotherAccountRow>
              <Button
                title={t`Add another LinkedIn account`}
                onClick={() => setIsAddingAnotherAccount(true)}
                variant="secondary"
              />
            </AddAnotherAccountRow>
          )}
        {shouldShowSignupForm && (
          <LinkedinSignup
            onSignupComplete={handleSignupComplete}
            onSignupError={handleSignupError}
            onSignupCancel={handleSignupCancel}
          />
        )}
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
