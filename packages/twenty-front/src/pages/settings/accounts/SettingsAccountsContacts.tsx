import { SettingsAccountsGoogleContactsSection } from '@/settings/accounts/components/SettingsAccountsGoogleContactsSection';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useLingui } from '@lingui/react/macro';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

export const SettingsAccountsContacts = () => {
  const { t } = useLingui();

  return (
    <SubMenuTopBarContainer
      title={t`Google Contacts`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`Google Contacts` },
      ]}
    >
      <SettingsPageContainer>
        <SettingsAccountsGoogleContactsSection />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};
