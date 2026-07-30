import { useCallback, useState } from 'react';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { ConnectedWhatsappUnipileAccounts } from './components/ConnectedWhatsappUnipileAccounts';
import { WhatsappUnipileQrCode } from './components/WhatsappUnipileQrCode';

const AddAnotherAccountRow = styled.div`
  display: flex;
  justify-content: flex-start;
  margin: 0.5rem 0 1rem;
`;

export const WhatsappUnipileAccounts = () => {
  const { t } = useLingui();
  const [shouldShowConnectQr, setShouldShowConnectQr] = useState(false);
  const [accountsLoadSettled, setAccountsLoadSettled] = useState(false);
  const [isAddingAnotherAccount, setIsAddingAnotherAccount] = useState(false);
  const [accountsRefreshTrigger, setAccountsRefreshTrigger] = useState(0);

  const handleAccountsLoaded = useCallback((showQr: boolean) => {
    setShouldShowConnectQr(showQr);
    setAccountsLoadSettled(true);
    if (showQr) {
      setIsAddingAnotherAccount(false);
    }
  }, []);

  const handleConnected = useCallback((_accountId: string) => {
    setIsAddingAnotherAccount(false);
    setAccountsRefreshTrigger((n) => n + 1);
  }, []);

  const showConnectForm =
    accountsLoadSettled &&
    (shouldShowConnectQr || isAddingAnotherAccount);

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
        {accountsLoadSettled &&
          !shouldShowConnectQr &&
          !isAddingAnotherAccount && (
            <AddAnotherAccountRow>
              <Button
                title={t`Add another WhatsApp account`}
                onClick={() => setIsAddingAnotherAccount(true)}
                variant="secondary"
              />
            </AddAnotherAccountRow>
          )}
        {showConnectForm && (
          <WhatsappUnipileQrCode onConnected={handleConnected} />
        )}
        <ConnectedWhatsappUnipileAccounts
          refreshTrigger={accountsRefreshTrigger}
          onAccountsLoaded={handleAccountsLoaded}
        />
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
