import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { WhatsAppEmbeddedSignup } from './WhatsappEmbeddedSignup';

export const WhatsappAccounts = () => {
  const { t } = useLingui();

  const FACEBOOK_WHATSAPP_APP_ID = '702966768619548';
  const FACEBOOK_WHATSAPP_CONFIGURATION_ID = '1115729326784816';

  return (
    <SettingsPageLayout
      title={t`WhatsApp Business`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`WhatsApp Business` },
      ]}
    >
      <SettingsPageContainer>
        <WhatsAppEmbeddedSignup
          appId={FACEBOOK_WHATSAPP_APP_ID}
          configId={FACEBOOK_WHATSAPP_CONFIGURATION_ID}
          onSignupComplete={(result) =>
            console.log('Signup complete:', result)
          }
          onSignupError={(error) => console.error('Signup error:', error)}
          onSignupCancel={(step) =>
            console.log('Signup cancelled at step:', step)
          }
        />
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
