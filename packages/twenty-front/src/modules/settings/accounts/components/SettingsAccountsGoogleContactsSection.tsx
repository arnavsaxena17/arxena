import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useRecoilValue } from 'recoil';
import { Button, H2Title, IconAddressBook, Section } from 'twenty-ui';

import { ConnectedAccount } from '@/accounts/types/ConnectedAccount';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { GOOGLE_CONTACTS_OAUTH_SCOPE } from '@/settings/accounts/constants/GoogleContactsOAuthScope';
import { useTriggerApisOAuth } from '@/settings/accounts/hooks/useTriggerApiOAuth';
import { SettingsPath } from '@/types/SettingsPath';
import { getSettingsPath } from '~/utils/navigation/getSettingsPath';

const StyledStatusRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

const StyledStatusText = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const getGoogleAccountWithContactsScope = (
  accounts: ConnectedAccount[],
): ConnectedAccount | undefined => {
  return accounts.find(
    (account) =>
      account.provider?.toLowerCase() === 'google' &&
      account.scopes?.includes(GOOGLE_CONTACTS_OAUTH_SCOPE),
  );
};

export const SettingsAccountsGoogleContactsSection = () => {
  const { t } = useLingui();
  const { triggerApisOAuth } = useTriggerApisOAuth();
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: CoreObjectNameSingular.ConnectedAccount,
  });

  const { records: accounts, loading } = useFindManyRecords<ConnectedAccount>({
    objectNameSingular: CoreObjectNameSingular.ConnectedAccount,
    filter: {
      accountOwnerId: {
        eq: currentWorkspaceMember?.id,
      },
    },
    recordGqlFields: generateDepthOneRecordGqlFields({ objectMetadataItem }),
  });

  const googleAccount = accounts.find(
    (account) => account.provider?.toLowerCase() === 'google',
  );
  const googleAccountWithContactsScope =
    getGoogleAccountWithContactsScope(accounts);
  const isConnected = !!googleAccountWithContactsScope;

  const handleConnectClick = () => {
    triggerApisOAuth('google', {
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
