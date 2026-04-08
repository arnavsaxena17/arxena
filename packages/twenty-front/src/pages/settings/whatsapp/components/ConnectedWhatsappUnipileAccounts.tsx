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
import type { UnipileWhatsappAccount } from 'twenty-shared';
import { tokenPairState } from '~/modules/auth/states/tokenPairState';
import { workspaceMemberProfileUnipileFieldsState } from '~/modules/unipile/states/workspaceMemberProfileUnipileFieldsState';
import {
  filterWhatsappAccountsForWorkspaceMemberProfile,
  hasMatchingConnectedWhatsappAccount,
  shouldRestrictWhatsappByProfile,
  whatsappAccountMatchesWorkspaceMemberProfile,
} from '~/modules/unipile/utils/matchUnipileToWorkspaceMemberProfile';
import { whatsappUnipileAccountsState } from '~/modules/whatsapp-unipile/states/whatsappUnipileAccountsState';
import { getWhatsappUnipileService } from '~/pages/settings/whatsapp/services/whatsapp-unipile-backend.service';

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
  background: linear-gradient(135deg, #25d366, #128c7e);
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
    const normalizedStatus = props.status?.toLowerCase();
    switch (normalizedStatus) {
      case 'connected':
        return css`
          color: #059669;
        `;
      case 'disconnected':
        return css`
          color: #dc2626;
        `;
      case 'pending':
      case 'connecting':
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
          background-color: #25d366;
          color: white;
          &:hover {
            background-color: #128c7e;
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
  background-color: #25d366;
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
    background-color: #128c7e;
  }
`;

interface ConnectedWhatsappUnipileAccountsProps {
  onAccountConnected?: () => void;
  onAccountsLoaded?: (hasConnected: boolean) => void;
}

export const ConnectedWhatsappUnipileAccounts: React.FC<
  ConnectedWhatsappUnipileAccountsProps
> = ({ onAccountConnected, onAccountsLoaded }) => {
  const getNormalizedStatus = useCallback(
    (status?: string | null) => (status ? status.toLowerCase() : ''),
    [],
  );
  
  console.log("ConnectedWhatsappUnipileAccounts got called");
  const [accounts, setAccounts] = useState<UnipileWhatsappAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousAccountsRef = useRef<UnipileWhatsappAccount[]>([]);

  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
  const setWhatsappUnipileAccounts = useSetRecoilState(
    whatsappUnipileAccountsState,
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

      const service = getWhatsappUnipileService();
      const allAccounts = await service.getAllAccounts(accessToken);

      // Filter to only show WhatsApp accounts
      const accountList = allAccounts.filter((acc) => acc.type === 'WHATSAPP');

      // Check if there's a new connected account that wasn't in the previous list
      const previousAccountIds = previousAccountsRef.current.map(
        (acc) => acc.id,
      );
      const newConnectedAccounts = accountList.filter(
        (acc) =>
          getNormalizedStatus(acc.status) === 'connected' &&
          acc.type === 'WHATSAPP' &&
          !previousAccountIds.includes(acc.id),
      );

      const accountToPersist = newConnectedAccounts.find((acc) => {
        if (acc.type !== 'WHATSAPP') {
          return false;
        }
        if (
          !workspaceMemberProfileUnipileFields ||
          !shouldRestrictWhatsappByProfile(workspaceMemberProfileUnipileFields)
        ) {
          return true;
        }
        return whatsappAccountMatchesWorkspaceMemberProfile(
          workspaceMemberProfileUnipileFields,
          acc,
        );
      });

      if (accountToPersist?.type === 'WHATSAPP') {
        try {
          const service = getWhatsappUnipileService();
          const result = await service.updateMemberAccount(
            accountToPersist.id,
            accessToken,
          );
          if (!result.success) {
            console.error(
              'Failed to update workspace member profile with WhatsApp account ID',
            );
          }
        } catch (apiKeyError) {
          console.error(
            'Failed to update workspace member profile with WhatsApp account ID:',
            apiKeyError,
          );
        }
      }

      setAccounts(accountList);
      previousAccountsRef.current = accountList;

      // Update Recoil state with WhatsApp Unipile accounts
      setWhatsappUnipileAccounts(accountList);

      const hasConnected = hasMatchingConnectedWhatsappAccount(
        accountList,
        workspaceMemberProfileUnipileFields,
      );
      console.log("Has Connected", hasConnected);
      console.log("New Connected Accounts", newConnectedAccounts);
      console.log("Accounts", accounts);
      console.log("Workspace Member Profile Unipile Fields", workspaceMemberProfileUnipileFields);
      console.log("Account List", accountList);
      console.log("Previous Accounts", previousAccountsRef.current);
      console.log("New Connected Accounts", newConnectedAccounts);
      if (onAccountsLoaded) {
        onAccountsLoaded(hasConnected);
      }

      if (newConnectedAccounts.length > 0 && onAccountConnected) {
        onAccountConnected();
      }
    } catch (err) {
      console.error('Failed to load WhatsApp accounts:', err);

      if (onAccountsLoaded) {
        onAccountsLoaded(false);
      }

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
            'WhatsApp service is temporarily unavailable. Please try again later.',
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
    setWhatsappUnipileAccounts,
    getNormalizedStatus,
    workspaceMemberProfileUnipileFields,
  ]);

  useEffect(() => {
    if (accessToken) {
      loadAccounts();
    } else {
      setLoading(false);
      onAccountsLoaded?.(false);
    }
  }, [accessToken, loadAccounts, onAccountsLoaded]);

  const handleDisconnect = async (accountId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to disconnect this WhatsApp account?',
      )
    ) {
      return;
    }

    try {
      const service = getWhatsappUnipileService();
      const result = await service.disconnectAccount(accountId, accessToken);

      if (result.success) {
        await loadAccounts();
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
      const service = getWhatsappUnipileService();
      await service.resyncAccount(accountId, accessToken);
      await loadAccounts();
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
      filterWhatsappAccountsForWorkspaceMemberProfile(
        accounts,
        workspaceMemberProfileUnipileFields,
      ),
    [accounts, workspaceMemberProfileUnipileFields],
  );

  if (loading) {
    return (
      <AccountsContainer>
        <AccountsTitle>Connected WhatsApp Accounts</AccountsTitle>
        <EmptyState>Loading accounts...</EmptyState>
      </AccountsContainer>
    );
  }

  return (
    <AccountsContainer>
      <AccountsTitle>Connected WhatsApp Accounts</AccountsTitle>

      {error && (
        <ErrorContainer>
          {error}
          <br />
          <RetryButton onClick={loadAccounts}>Retry</RetryButton>
        </ErrorContainer>
      )}

      {accounts.length === 0 ? (
        <EmptyState>
          No WhatsApp accounts connected yet. Use the form above to connect your
          first account.
        </EmptyState>
      ) : displayedAccounts.length === 0 ? (
        <EmptyState>
          No connected WhatsApp account matches the phone number on your
          workspace member profile. Update your profile phone or connect the
          account that uses that number.
        </EmptyState>
      ) : (
        displayedAccounts.map((account) => (
          <AccountCard key={account.id}>
            <AccountInfo>
              <Avatar>{getInitials(account.username)}</Avatar>
              <AccountDetails>
                <AccountName>{account.username}</AccountName>
                {account.phone_number && (
                  <AccountName
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 'normal',
                      color: '#6b7280',
                    }}
                  >
                    {account.phone_number}
                  </AccountName>
                )}
                <AccountStatus status={account.status}>
                  {account.status}
                </AccountStatus>
                <AccountId>{account.id}</AccountId>
              </AccountDetails>
            </AccountInfo>

            <AccountActions>
              {getNormalizedStatus(account.status) === 'connected' && (
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
