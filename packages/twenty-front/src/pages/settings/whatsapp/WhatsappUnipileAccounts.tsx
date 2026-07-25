import { useCallback, useState } from 'react';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { ConnectedWhatsappUnipileAccounts } from './components/ConnectedWhatsappUnipileAccounts';
import { WhatsappUnipileQrCode } from './components/WhatsappUnipileQrCode';

export const WhatsappUnipileAccounts = () => {
  const { t } = useLingui();
  const [shouldShowConnectQr, setShouldShowConnectQr] = useState(false);
  const [accountsLoadSettled, setAccountsLoadSettled] = useState(false);

  const handleAccountsLoaded = useCallback((showQr: boolean) => {
    setShouldShowConnectQr(showQr);
    setAccountsLoadSettled(true);
  }, []);

  return (
    <SettingsPageLayout
      title={t`WhatsApp Unipile`}
      links={[
        {
          children: t`User`,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: t`Accounts`,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: t`WhatsApp Unipile` },
      ]}
    >
      <SettingsPageContainer>
        {accountsLoadSettled && shouldShowConnectQr && (
          <WhatsappUnipileQrCode />
        )}
        <ConnectedWhatsappUnipileAccounts
          onAccountsLoaded={handleAccountsLoaded}
        />
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
