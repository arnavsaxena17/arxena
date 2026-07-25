import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useLingui } from '@lingui/react/macro';

import { type ConnectedAccount } from '@/accounts/types/ConnectedAccount';
import { GOOGLE_CONTACTS_OAUTH_SCOPE } from '@/settings/accounts/constants/GoogleContactsOAuthScope';
import { useMyConnectedAccounts } from '@/settings/accounts/hooks/useMyConnectedAccounts';
import { useTriggerApisOAuth } from '@/settings/accounts/hooks/useTriggerApiOAuth';
import { ConnectedAccountProvider, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { IconAddressBook } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { H2Title } from 'twenty-ui/typography';

const StyledStatusRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  margin-top: ${themeCssVariables.spacing[4]};
`;

const StyledStatusText = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const getGoogleAccountWithContactsScope = (
  accounts: ConnectedAccount[],
): ConnectedAccount | undefined => {
  return accounts.find(
    (account) =>
      account.provider === ConnectedAccountProvider.GOOGLE &&
      account.scopes?.includes(GOOGLE_CONTACTS_OAUTH_SCOPE) === true,
  );
};

export const SettingsAccountsGoogleContactsSection = () => {
  const { t } = useLingui();
  const { triggerApisOAuth } = useTriggerApisOAuth();
  const { accounts, loading } = useMyConnectedAccounts();

  const googleAccount = accounts.find(
    (account) => account.provider === ConnectedAccountProvider.GOOGLE,
  );
  const googleAccountWithContactsScope =
    getGoogleAccountWithContactsScope(accounts);
  const isConnected = googleAccountWithContactsScope != null;

  const handleConnectClick = () => {
    void triggerApisOAuth(ConnectedAccountProvider.GOOGLE, {
      redirectLocation: getSettingsPath(SettingsPath.AccountsContacts),
      loginHint: googleAccount?.handle,
    });
  };

  return (
    <Section>
      <H2Title
        title={t`Google Contacts`}
        description={t`Connect Google to add candidates to your contacts when sourcing.`}
      />
      <StyledStatusRow>
        <StyledStatusText>
          {loading
            ? t`Checking connection...`
            : isConnected
              ? t`Connected as ${googleAccountWithContactsScope?.handle}`
              : googleAccount
                ? t`${googleAccount.handle} is connected but needs contacts permission. Reconnect to grant access.`
                : t`No Google account connected.`}
        </StyledStatusText>
        <Button
          Icon={IconAddressBook}
          title={isConnected ? t`Reconnect Google` : t`Connect Google Contacts`}
          variant="secondary"
          onClick={handleConnectClick}
          disabled={loading}
        />
      </StyledStatusRow>
    </Section>
  );
};
