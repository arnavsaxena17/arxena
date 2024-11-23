import { useRecoilValue } from 'recoil';
import { H2Title, IconSettings } from 'twenty-ui';

import { ConnectedAccount } from '@/accounts/types/ConnectedAccount';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { SettingsAccountLoader } from '@/settings/accounts/components/SettingsAccountLoader';
import { SettingsAccountsConnectedAccountsListCard } from '@/settings/accounts/components/SettingsAccountsConnectedAccountsListCard';
import { SettingsAccountsEmailsBlocklistSection } from '@/settings/accounts/components/SettingsAccountsEmailsBlocklistSection';
import { SettingsAccountsSettingsSection } from '@/settings/accounts/components/SettingsAccountsSettingsSection';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/SubMenuTopBarContainer';
import { Section } from '@/ui/layout/section/components/Section';
import { Breadcrumb } from '@/ui/navigation/bread-crumb/components/Breadcrumb';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import WhatsAppEmbeddedSignup from './WhatsappEmbeddedSignup';
import type { SignupCompleteData } from './types/whatsappEmbeddedSignUpTypes';





export const WhatsappAccounts = () => {
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

  const isBlocklistEnabled = useIsFeatureEnabled('IS_BLOCKLIST_ENABLED');


  const handleSignupComplete = (data: SignupCompleteData) => {
    console.log('Signup completed:', data);
  };

  const handleSignupCancel = (currentStep: string) => {
    console.log('Signup cancelled at step:', currentStep);
  };

  const handleSignupError = (error: Error) => {
    console.error('Signup error:', error);
  };


  return (
    <SubMenuTopBarContainer Icon={IconSettings} title="Settings">
      <SettingsPageContainer>
        <Breadcrumb links={[{ children: 'Accounts' }]} />

    <WhatsAppEmbeddedSignup
      appId={process.env.FACEBOOK_WHATSAPP_APP_ID || ''}
      configId={process.env.FACEBOOK_WHATSAPP_CONFIGURATION_ID || ''}
      onSignupComplete={handleSignupComplete}
      onSignupCancel={handleSignupCancel}
      onSignupError={handleSignupError}
    />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
