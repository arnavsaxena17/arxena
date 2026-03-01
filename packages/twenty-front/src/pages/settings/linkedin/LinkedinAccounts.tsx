import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconSettings } from 'twenty-ui';

import { ConnectedAccount } from '@/accounts/types/ConnectedAccount';
import { useApiKeysRecoil } from '@/arx-jd-upload/hooks/useApiKeysRecoil';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react';
import type { LinkedinSignupCompleteData } from 'twenty-shared';
import { Mixpanel } from '~/mixpanel';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';
import { LinkedinSignup } from './LinkedinSignup';
import { ConnectedLinkedinAccounts } from './components/ConnectedLinkedinAccounts';

export const LinkedinAccounts = () => {
  const [hasConnectedAccounts, setHasConnectedAccounts] = useState(false);
  const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const { updateSpecificApiKey } = useApiKeysRecoil();

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.ConnectedAccount,
  });

  const { records: accounts, loading } = useFindManyRecords<ConnectedAccount>({
    objectNameSingular: 'connectedAccount',
    filter: {
      accountOwnerId: {
        eq: currentWorkspaceMember?.id,
      },
    },
    recordGqlFields: generateDepthOneRecordGqlFields({ objectMetadataItem }),
  });

  const handleSignupComplete = useCallback(
    async (data: LinkedinSignupCompleteData) => {
      Mixpanel.track('linkedin_connect_complete');
      setHasConnectedAccounts(true);
      if (data.accountId) {
        try {
          await updateSpecificApiKey('linkedin_unipile_account_id', data.accountId);
          setAccountsRefreshTrigger((n) => n + 1);
        } catch (err) {
          console.error('Failed to save LinkedIn account id to workspace:', err);
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
    // TODO: Show user-friendly error message
  };

  const handleAccountConnected = () => {
    Mixpanel.track('linkedin_connect_complete');
    setHasConnectedAccounts(true);
  };

  const handleAccountsLoaded = (hasConnected: boolean) => {
    setHasConnectedAccounts(hasConnected);
  };

  return (
    <SubMenuTopBarContainer 
      Icon={IconSettings} 
      title="Linkedin Business" 
      links={[
        {
          children: <Trans id="User">User</Trans>,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: <Trans id="Accounts">Accounts</Trans>,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: <Trans id="Linkedin Business">Linkedin Business</Trans> },
      ]}
    >
      <SettingsPageContainer>
        {/* {!hasConnectedAccounts && ( */}
          <LinkedinSignup
            onSignupComplete={handleSignupComplete}
            onSignupError={handleSignupError}
            onSignupCancel={handleSignupCancel}
          />
        {/* )} */}
        <ConnectedLinkedinAccounts
          refreshTrigger={accountsRefreshTrigger}
          onAccountConnected={handleAccountConnected}
          onAccountsLoaded={handleAccountsLoaded}
        />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};