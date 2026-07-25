import { SettingsAccountsGoogleContactsSection } from '@/settings/accounts/components/SettingsAccountsGoogleContactsSection';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';

export const SettingsAccountsContacts = () => {
  const { t } = useLingui();

  return (
    <SettingsPageLayout
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
    </SettingsPageLayout>
  );
};
