import { css } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import type { UnipileLinkedinAccount } from 'twenty-shared';
import { tokenPairState } from '~/modules/auth/states/tokenPairState';
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
  
  ${props => {
    switch (props.status) {
      case 'connected':
        return css`color: #059669;`;
      case 'disconnected':
        return css`color: #dc2626;`;
      case 'pending':
        return css`color: #d97706;`;
      default:
        return css`color: #6b7280;`;
    }
  }}
`;

const AccountActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  ${props => {
    switch (props.variant) {
      case 'primary':
        return css`
          background-color: #0077b5;
          color: white;
          &:hover { background-color: #005885; }
        `;
      case 'danger':
        return css`
          background-color: #dc2626;
          color: white;
          &:hover { background-color: #b91c1c; }
        `;
      default:
        return css`
          background-color: #f3f4f6;
          color: #374151;
          &:hover { background-color: #e5e7eb; }
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

interface ConnectedLinkedinAccountsProps {
  onAccountConnected?: () => void;
}

export const ConnectedLinkedinAccounts: React.FC<ConnectedLinkedinAccountsProps> = ({
  onAccountConnected,
}) => {
  const [accounts, setAccounts] = useState<UnipileLinkedinAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get access token from Recoil state
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const service = getLinkedinService();
      const accountList = await service.getAllAccounts(accessToken);
      setAccounts(accountList);
      setError(null);
    } catch (err) {
      console.error('Failed to load LinkedIn accounts:', err);
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadAccounts();
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReconnect = async (accountId: string) => {
    try {
      const service = getLinkedinService();
      const currentUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      
      const response = await (service as any).createHostedAuthLink({
        type: 'reconnect',
        reconnect_account: accountId,
        success_redirect_url: `${currentUrl}?linkedin_reconnect=success`,
        failure_redirect_url: `${currentUrl}?linkedin_reconnect=failure`,
      }, accessToken);

      if (response.success && response.hosted_link) {
        window.location.href = response.hosted_link;
      }
    } catch (err) {
      console.error('Failed to create reconnection link:', err);
      setError('Failed to create reconnection link');
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to disconnect this LinkedIn account?')) {
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
      
      {error && (
        <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {accounts.length === 0 ? (
        <EmptyState>
          No LinkedIn accounts connected yet. Use the form above to connect your first account.
        </EmptyState>
      ) : (
        accounts.map((account) => (
          <AccountCard key={account.id}>
            <AccountInfo>
              <Avatar>
                {getInitials(account.username)}
              </Avatar>
              <AccountDetails>
                <AccountName>{account.username}</AccountName>
                <AccountStatus status={account.status}>
                  {account.status}
                </AccountStatus>
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