import { useRecoilValue } from 'recoil';
import { IconSettings } from 'twenty-ui';

import { ConnectedAccount } from '@/accounts/types/ConnectedAccount';
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
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';
import { LinkedinSignup } from './LinkedinSignup';
import { ConnectedLinkedinAccounts } from './components/ConnectedLinkedinAccounts';

export const LinkedinAccounts = () => {
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

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

  const handleSignupComplete = (data: LinkedinSignupCompleteData) => {
    console.log('LinkedIn signup completed:', data);
    // TODO: Save account data to workspace
    // This would typically involve calling a GraphQL mutation to save the connected account
  };

  const handleSignupCancel = (currentStep: string) => {
    console.log('LinkedIn signup cancelled at step:', currentStep);
  };

  const handleSignupError = (error: Error) => {
    console.error('LinkedIn signup error:', error);
    // TODO: Show user-friendly error message
  };

  return (
    <SubMenuTopBarContainer 
      Icon={IconSettings} 
      title="LinkedIn Business" 
      links={[
        {
          children: <Trans id="User">User</Trans>,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: <Trans id="Accounts">Accounts</Trans>,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: <Trans id="LinkedIn Business">LinkedIn Business</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <LinkedinSignup
          onSignupComplete={handleSignupComplete}
          onSignupError={handleSignupError}
          onSignupCancel={handleSignupCancel}
        />
        <ConnectedLinkedinAccounts 
          onAccountConnected={() => {
            console.log('LinkedIn account connected successfully');
            // State is automatically updated through Recoil, no page reload needed
          }}
        />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};