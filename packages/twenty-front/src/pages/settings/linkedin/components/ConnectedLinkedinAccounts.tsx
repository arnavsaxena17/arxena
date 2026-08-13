import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { LinkedinStoredProfileUnipileActions } from '@/unipile/components/LinkedinStoredProfileUnipileActions';
import { styled } from '@linaria/react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { UnipileLinkedinAccount } from 'twenty-shared/arx';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Mixpanel } from '~/mixpanel';
import { tokenPairState } from '~/modules/auth/states/tokenPairState';
import { linkedinUnipileAccountsState } from '~/modules/linkedin-unipile/states/linkedinUnipileAccountsState';
import { workspaceMemberProfileUnipileFieldsState } from '~/modules/unipile/states/workspaceMemberProfileUnipileFieldsState';
import {
    filterLinkedinAccountsForWorkspaceMemberProfile,
    hasMatchingConnectedLinkedinAccount,
    linkedinAccountMatchesWorkspaceMemberProfile,
    shouldRestrictLinkedinByProfile,
} from '~/modules/unipile/utils/matchUnipileToWorkspaceMemberProfile';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

const AccountsContainer = styled.div`
  margin-top: 2rem;
`;

const AccountsTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
`;

const AccountCard = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 1rem;
`;

const AccountInfo = styled.div`
  align-items: center;
  display: flex;
  gap: 0.75rem;
`;

const Avatar = styled.div`
  align-items: center;
  background: linear-gradient(135deg, #0077b5, #00a0dc);
  border-radius: 50%;
  color: white;
  display: flex;
  font-size: 1rem;
  font-weight: 600;
  height: 40px;
  justify-content: center;
  width: 40px;
`;

const AccountDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

const AccountName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: 0.9rem;
  font-weight: 600;
`;

const AccountStatus = styled.span<{ status: string }>`
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  ${(props) => {
    switch (props.status) {
      case 'connected':
        return `
          color: ${themeCssVariables.color.green};
        `;
      case 'disconnected':
        return `
          color: ${themeCssVariables.color.red};
        `;
      case 'pending':
        return `
          color: ${themeCssVariables.color.orange};
        `;
      default:
        return `
          color: ${themeCssVariables.font.color.tertiary};
        `;
    }
  }}
`;

const AccountId = styled.span`
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: 4px;
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-block;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  padding: 0.25rem 0.5rem;
`;

const AccountActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{
  variant?: 'primary' | 'secondary' | 'danger';
}>`
  background-color: ${({ variant }) => {
    if (variant === 'primary') {
      return '#0077b5';
    }
    if (variant === 'danger') {
      return themeCssVariables.color.red;
    }
    return themeCssVariables.background.tertiary;
  }};
  border: none;
  border-radius: 4px;
  color: ${({ variant }) =>
    variant === 'primary' || variant === 'danger'
      ? 'white'
      : themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.5rem 0.75rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ variant }) => {
      if (variant === 'primary') {
        return '#005885';
      }
      if (variant === 'danger') {
        return themeCssVariables.tag.background.red;
      }
      return themeCssVariables.background.quaternary;
    }};
  }
`;

const EmptyState = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 0.9rem;
  padding: 2rem;
  text-align: center;
`;

const ErrorContainer = styled.div`
  background: ${themeCssVariables.background.transparent.danger};
  border: 1px solid ${themeCssVariables.border.color.danger};
  border-radius: 8px;
  color: ${themeCssVariables.font.color.danger};
  font-size: 0.875rem;
  margin-bottom: 1rem;
  padding: 1rem;
`;

const RetryButton = styled.button`
  background-color: #0077b5;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #005885;
  }
`;

interface ConnectedLinkedinAccountsProps {
  refreshTrigger?: number;
  onAccountConnected?: () => void;
  onAccountsLoaded?: (hasConnected: boolean) => void;
}

export const ConnectedLinkedinAccounts: React.FC<
  ConnectedLinkedinAccountsProps
> = ({ refreshTrigger, onAccountConnected, onAccountsLoaded }) => {
  const [accounts, setAccounts] = useState<UnipileLinkedinAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousAccountsRef = useRef<UnipileLinkedinAccount[]>([]);

  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const setLinkedinUnipileAccounts = useSetAtomState(
    linkedinUnipileAccountsState,
  );
  const workspaceMemberProfileUnipileFields = useAtomStateValue(
    workspaceMemberProfileUnipileFieldsState,
  );

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!accessToken) {
        setError(
          'Authentication token not available. Please refresh the page and try again.',
        );
        return;
      }

      const service = getLinkedinService();
      const allAccounts = await service.getAllAccounts(accessToken);

      // Filter to only show LinkedIn accounts
      const accountList = allAccounts.filter((acc) => acc.type === 'LINKEDIN');

      // Check if there's a new connected account that wasn't in the previous list
      const previousAccountIds = previousAccountsRef.current.map(
        (acc) => acc.id,
      );
      const newConnectedAccounts = accountList.filter(
        (acc) =>
          acc.status === 'connected' &&
          acc.type === 'LINKEDIN' &&
          !previousAccountIds.includes(acc.id),
      );

      const accountToPersist = newConnectedAccounts.find((acc) => {
        if (acc.type !== 'LINKEDIN') {
          return false;
        }
        if (
          !workspaceMemberProfileUnipileFields ||
          !shouldRestrictLinkedinByProfile(workspaceMemberProfileUnipileFields)
        ) {
          return true;
        }
        return linkedinAccountMatchesWorkspaceMemberProfile(
          workspaceMemberProfileUnipileFields,
          acc,
        );
      });

      if (accountToPersist?.type === 'LINKEDIN') {
        try {
          const service = getLinkedinService();
          const result = await service.updateMemberAccount(
            accountToPersist.id,
            accessToken,
          );
          if (!result.success) {
            console.error(
              'Failed to update workspace member profile with LinkedIn account ID',
            );
          }
        } catch (apiKeyError) {
          console.error(
            'Failed to update workspace member profile with LinkedIn account ID:',
            apiKeyError,
          );
        }
      }

      setAccounts(accountList);
      previousAccountsRef.current = accountList;
      setLinkedinUnipileAccounts(accountList);

      const hasConnected = hasMatchingConnectedLinkedinAccount(
        accountList,
        workspaceMemberProfileUnipileFields,
      );
      if (onAccountsLoaded) {
        onAccountsLoaded(hasConnected);
      }

      // Call the callback if there were new accounts connected
      if (newConnectedAccounts.length > 0 && onAccountConnected) {
        onAccountConnected();
      }
    } catch (err) {
      console.error('Failed to load LinkedIn accounts:', err);

      // Provide more specific error messages based on the error type
      if (err instanceof Error) {
        if (err.message.includes('403') || err.message.includes('Forbidden')) {
          setError(
            'Access denied. Please check your permissions or contact support.',
          );
        } else if (
          err.message.includes('401') ||
          err.message.includes('Unauthorized')
        ) {
          setError(
            'Authentication failed. Please refresh the page and try again.',
          );
        } else if (
          err.message.includes('500') ||
          err.message.includes('Internal Server Error')
        ) {
          setError('Server error. Please try again later or contact support.');
        } else if (
          err.message.includes('Failed to communicate with Unipile API')
        ) {
          setError(
            'LinkedIn service is temporarily unavailable. Please try again later.',
          );
        } else {
          setError(`Failed to load accounts: ${err.message}`);
        }
      } else {
        setError('Failed to load accounts. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    onAccountConnected,
    onAccountsLoaded,
    setLinkedinUnipileAccounts,
    workspaceMemberProfileUnipileFields,
  ]);

  useEffect(() => {
    if (accessToken) {
      loadAccounts();
    }
  }, [accessToken, loadAccounts]);

  useEffect(() => {
    if (accessToken && refreshTrigger != null && refreshTrigger > 0) {
      loadAccounts();
    }
  }, [refreshTrigger, accessToken, loadAccounts]);

  const handleReconnect = async (accountId: string) => {
    Mixpanel.track('linkedin_connect_start', { method: 'reconnect' });
    try {
      const service = getLinkedinService();
      const currentUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      console.log('currentUrl::::', currentUrl);

      const response = await (service as any).createHostedAuthLink(
        {
          type: 'reconnect',
          reconnect_account: accountId,
          success_redirect_url: `${currentUrl}?linkedin_reconnect=success`,
          failure_redirect_url: `${currentUrl}?linkedin_reconnect=failure`,
        },
        accessToken,
      );

      if (response.success && response.hosted_link) {
        window.location.href = response.hosted_link;
      }
    } catch (err) {
      console.error('Failed to create reconnection link:', err);
      setError('Failed to create reconnection link');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to disconnect this LinkedIn account?',
      )
    ) {
      return;
    }

    try {
      const service = getLinkedinService();
      const result = await service.disconnectAccount(accountId, accessToken);

      if (result.success) {
        await loadAccounts(); // Refresh the list
      } else {
        setError('Failed to disconnect account');
      }
    } catch (err) {
      console.error('Failed to disconnect account:', err);
      setError('Failed to disconnect account');
    }
  };

  const handleResync = async (accountId: string) => {
    try {
      const service = getLinkedinService();
      await service.resyncAccount(accountId, accessToken);
      await loadAccounts(); // Refresh the list
    } catch (err) {
      console.error('Failed to resync account:', err);
      setError('Failed to resync account');
    }
  };

  const getInitials = (username: string): string => {
    return username.substring(0, 2).toUpperCase();
  };

  const displayedAccounts = useMemo(
    () =>
      filterLinkedinAccountsForWorkspaceMemberProfile(
        accounts,
        workspaceMemberProfileUnipileFields,
      ),
    [accounts, workspaceMemberProfileUnipileFields],
  );

  if (loading) {
    return (
      <AccountsContainer>
        <AccountsTitle>Connected LinkedIn Accounts</AccountsTitle>
        <EmptyState>Loading accounts...</EmptyState>
      </AccountsContainer>
    );
  }

  return (
    <AccountsContainer>
      <AccountsTitle>Connected LinkedIn Accounts</AccountsTitle>

      <LinkedinStoredProfileUnipileActions
        onAfterChange={() => {
          void loadAccounts();
        }}
      />

      {error && (
        <ErrorContainer>
          {error}
          <br />
          <RetryButton onClick={loadAccounts}>Retry</RetryButton>
        </ErrorContainer>
      )}

      {accounts.length === 0 ? (
        <EmptyState>
          No LinkedIn accounts connected yet. Use the form above to connect your
          first account.
        </EmptyState>
      ) : displayedAccounts.length === 0 ? (
        <EmptyState>
          No connected LinkedIn account matches the LinkedIn URL on your
          workspace member profile. Update your profile URL or connect the
          account that matches it.
        </EmptyState>
      ) : (
        displayedAccounts.map((account) => (
          <AccountCard key={account.id}>
            <AccountInfo>
              <Avatar>{getInitials(account.username)}</Avatar>
              <AccountDetails>
                <AccountName>{account.username}</AccountName>
                <AccountStatus status={account.status}>
                  {account.status}
                </AccountStatus>
                <AccountId>{account.id}</AccountId>
              </AccountDetails>
            </AccountInfo>

            <AccountActions>
              {account.status === 'disconnected' && (
                <ActionButton
                  variant="primary"
                  onClick={() => handleReconnect(account.id)}
                >
                  Reconnect
                </ActionButton>
              )}

              {account.status === 'connected' && (
                <ActionButton
                  variant="secondary"
                  onClick={() => handleResync(account.id)}
                >
                  Resync
                </ActionButton>
              )}

              <ActionButton
                variant="danger"
                onClick={() => handleDisconnect(account.id)}
              >
                Disconnect
              </ActionButton>
            </AccountActions>
          </AccountCard>
        ))
      )}
    </AccountsContainer>
  );
};
