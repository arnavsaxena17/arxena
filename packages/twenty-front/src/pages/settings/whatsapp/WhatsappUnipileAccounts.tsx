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
  const [hasConnectedAccounts, setHasConnectedAccounts] = useState(false);
  const [accountsLoadSettled, setAccountsLoadSettled] = useState(false);

  const handleAccountConnected = useCallback(() => {
    console.log('WhatsApp account connected successfully');
    setHasConnectedAccounts(true);
  }, []);

  const handleAccountsLoaded = useCallback((hasConnected: boolean) => {
    console.log("handleAccountsLoaded:",hasConnected)
    setHasConnectedAccounts(hasConnected);
    setAccountsLoadSettled(true);
  }, []);

  console.log("accountsLoadSettled:",accountsLoadSettled)
  console.log("hasConnectedAccounts:",hasConnectedAccounts)
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
        {accountsLoadSettled && !hasConnectedAccounts && (
          <WhatsappUnipileQrCode onConnected={handleAccountConnected} />
        )}
        <ConnectedWhatsappUnipileAccounts 
          onAccountConnected={handleAccountConnected}
          onAccountsLoaded={handleAccountsLoaded}
        />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};

