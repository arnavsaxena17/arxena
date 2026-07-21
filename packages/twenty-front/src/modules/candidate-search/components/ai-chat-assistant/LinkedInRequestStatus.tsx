import { IconAlertCircle } from 'twenty-ui/icons';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const StyledRequestStatus = styled.div<{ warning?: boolean; maxed?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  
  ${({ warning, maxed, theme }) => {
    if (maxed) {
      return `
        background-color: ${theme.color.red10};
        color: ${theme.color.red};
        border: 1px solid ${theme.color.red20};
      `;
    }
    if (warning) {
      return `
        background-color: ${theme.color.orange10};
        color: ${theme.color.orange};
        border: 1px solid ${theme.color.orange20};
      `;
    }
    return `
      background-color: ${theme.background.secondary};
      color: ${theme.font.color.secondary};
      border: 1px solid ${theme.border.color.light};
    `;
  }}
`;

interface RequestStatus {
  count: number;
  limit: number;
  remaining: number;
  warningThreshold: number;
}

export const LinkedInRequestStatus = () => {
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenPair = useRecoilValue(tokenPairState);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/linkedin-request-status`, {
        headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'Content-Type': 'application/json', },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setStatus({
          count: data.count,
          limit: data.limit,
          remaining: data.remaining,
          warningThreshold: data.warningThreshold,
        });
      } else {
        throw new Error(data.message || 'Failed to fetch request status');
      }
    } catch (err) {
      console.error('Error fetching LinkedIn request status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch request status');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <StyledRequestStatus>
        <IconAlertCircle size={16} />
        <span>Loading LinkedIn request status...</span>
      </StyledRequestStatus>
    );
  }

  if (error) {
    return (
      <StyledRequestStatus>
        <IconAlertCircle size={16} />
        <span>Error: {error}</span>
      </StyledRequestStatus>
    );
  }

  if (!status) {
    return null;
  }

  const isWarning = status.count >= status.warningThreshold;
  const isMaxed = status.count >= status.limit;

  return (
    <StyledRequestStatus warning={isWarning} maxed={isMaxed}>
      <IconAlertCircle size={16} />
      <span>
        LinkedIn Searches: {status.count}/{status.limit} today
        {isMaxed && ' (Limit reached)'}
        {isWarning && !isMaxed && ' (Approaching limit)'}
      </span>
    </StyledRequestStatus>
  );
};
