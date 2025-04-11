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
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';
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

  // const isBlocklistEnabled = useIsFeatureEnabled('IS_BLOCKLIST_ENABLED');

  const handleSignupComplete = (data: SignupCompleteData) => {
    console.log('Signup completed:', data);
  };

  const handleSignupCancel = (currentStep: string) => {
    console.log('Signup cancelled at step:', currentStep);
  };

  const handleSignupError = (error: Error) => {
    console.error('Signup error:', error);
  };

  const FACEBOOK_WHATSAPP_APP_ID = '702966768619548';
  const FACEBOOK_WHATSAPP_CONFIGURATION_ID = '1115729326784816';
  // console.log('This is the process.env.FACEBOOK_WHATSAPP_APP_ID:', process.env.FACEBOOK_WHATSAPP_APP_ID);
  // console.log('This is the process.env.FACEBOOK_WHATSAPP_CONFIGURATION_ID:', process.env.FACEBOOK_WHATSAPP_CONFIGURATION_ID);

  return (

        // <SubMenuTopBarContainer
    //   title={t`Calendars`}
    //   links={[
    //     {
    //       children: <Trans>User</Trans>,
    //       href: getSettingsPath(SettingsPath.ProfilePage),
    //     },
    //     {
    //       children: <Trans>Accounts</Trans>,
    //       href: getSettingsPath(SettingsPath.Accounts),
    //     },
    //     { children: <Trans>Calendars</Trans> },
    //   ]}
    // >
    <SubMenuTopBarContainer Icon={IconSettings} title="Whatsapp Business" links={[
            {
              children: <Trans id="User">User</Trans>,
              href: getSettingsPath(SettingsPath.ProfilePage),
            },
            {
              children: <Trans id="Accounts">Accounts</Trans>,
              href: getSettingsPath(SettingsPath.Accounts),
            },
            { children: <Trans id="Whatsapp Business">Calendars</Trans> },
          ]}>
      <SettingsPageContainer>
        {/* <Breadcrumb links={[{ children: 'Accounts' }]} /> */}
        <WhatsAppEmbeddedSignup
          appId={FACEBOOK_WHATSAPP_APP_ID || ''}
          configId={FACEBOOK_WHATSAPP_CONFIGURATION_ID || ''}
          onSignupComplete={result => console.log('Signup complete:', result)}
          onSignupError={error => console.error('Signup error:', error)}
          onSignupCancel={step => console.log('Signup cancelled at step:', step)}
        />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
