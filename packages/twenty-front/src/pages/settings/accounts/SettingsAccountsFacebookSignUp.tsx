import { useLingui } from '@lingui/react/macro';
import { WhatsappAccounts } from '~/pages/settings/whatsapp/WhatsappsAccounts';

export const SettingsAccountsFacebookSignUp = () => {
  const { t } = useLingui();

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
          <WhatsappAccounts />
              // </SubMenuTopBarContainer>
          
  );
};
