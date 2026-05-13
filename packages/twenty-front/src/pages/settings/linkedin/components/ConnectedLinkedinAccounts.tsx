import { css } from '@emotion/react';
import styled from '@emotion/styled';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import type { UnipileLinkedinAccount } from 'twenty-shared';
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
import { LinkedinStoredProfileUnipileActions } from '@/unipile/components/LinkedinStoredProfileUnipileActions';
import { getLinkedinService } from '~/pages/settings/linkedin/services/linkedin-backend.service';

const AccountsContainer = styled.div`
  margin-top: 2rem;
`;

const AccountsTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 1rem 0;
`;

const AccountCard = styled.div`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const AccountInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #0077b5, #00a0dc);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 1rem;
`;

const AccountDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

const AccountName = styled.span`
  font-weight: 600;
  color: #1a1a1a;
  font-size: 0.9rem;
`;

const AccountStatus = styled.span<{ status: string }>`
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${(props) => {
    switch (props.status) {
      case 'connected':
        return css`
          color: #059669;
        `;
      case 'disconnected':
        return css`
          color: #dc2626;
        `;
      case 'pending':
        return css`
          color: #d97706;
        `;
      default:
        return css`
          color: #6b7280;
        `;
    }
  }}
`;

const AccountId = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background-color: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-top: 0.25rem;
  display: inline-block;
`;

const AccountActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{
  variant?: 'primary' | 'secondary' | 'danger';
}>`
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  ${(props) => {
    switch (props.variant) {
      case 'primary':
        return css`
          background-color: #0077b5;
          color: white;
          &:hover {
            background-color: #005885;
          }
        `;
      case 'danger':
        return css`
          background-color: #dc2626;
          color: white;
          &:hover {
            background-color: #b91c1c;
          }
        `;
      default:
        return css`
          background-color: #f3f4f6;
          color: #374151;
          &:hover {
            background-color: #e5e7eb;
          }
        `;
    }
  }}
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-size: 0.9rem;
`;

const ErrorContainer = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #dc2626;
  font-size: 0.875rem;
`;

const RetryButton = styled.button`
  background-color: #0077b5;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
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

  // Get access token from Recoil state
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
  const setLinkedinUnipileAccounts = useSetRecoilState(
    linkedinUnipileAccountsState,
  );
  const workspaceMemberProfileUnipileFields = useRecoilValue(
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
