import { useCallback, useState } from 'react';
import { IconSettings } from 'twenty-ui';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPath } from '@/types/SettingsPath';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { Trans } from '@lingui/react';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';
import { ConnectedWhatsappUnipileAccounts } from './components/ConnectedWhatsappUnipileAccounts';
import { WhatsappUnipileQrCode } from './components/WhatsappUnipileQrCode';

export const WhatsappUnipileAccounts = () => {
  const [shouldShowConnectQr, setShouldShowConnectQr] = useState(false);
  const [accountsLoadSettled, setAccountsLoadSettled] = useState(false);

  const handleAccountsLoaded = useCallback((showQr: boolean) => {
    setShouldShowConnectQr(showQr);
    setAccountsLoadSettled(true);
  }, []);

  console.log("shouldShowConnectQr:",shouldShowConnectQr)
  console.log("accountsLoadSettled:",accountsLoadSettled)
  return (
    <SubMenuTopBarContainer
      Icon={IconSettings}
      title="WhatsApp Unipile"
      links={[
        {
          children: <Trans id="User">User</Trans>,
          href: getSettingsPath(SettingsPath.ProfilePage),
        },
        {
          children: <Trans id="Accounts">Accounts</Trans>,
          href: getSettingsPath(SettingsPath.Accounts),
        },
        { children: <Trans id="WhatsApp Unipile">WhatsApp Unipile</Trans> },
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
    </SubMenuTopBarContainer>
  );
};
