import { IconAlertCircle } from 'twenty-ui/icon';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useEffect, useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledRequestStatus = styled.div<{ warning?: boolean; maxed?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  
  ${({ warning, maxed }) => {
    if (maxed) {
      return `
        background-color: ${themeCssVariables.color.red10};
        color: ${themeCssVariables.color.red};
        border: 1px solid ${themeCssVariables.color.red2};
      `;
    }
    if (warning) {
      return `
        background-color: ${themeCssVariables.color.orange10};
        color: ${themeCssVariables.color.orange};
        border: 1px solid ${themeCssVariables.color.orange2};
      `;
    }
    return `
      background-color: ${themeCssVariables.background.secondary};
      color: ${themeCssVariables.font.color.secondary};
      border: 1px solid ${themeCssVariables.border.color.light};
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
  const tokenPair = useAtomStateValue(tokenPairState);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/candidate-search/linkedin-request-status`, {
        headers: { Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`, 'Content-Type': 'application/json', },
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
