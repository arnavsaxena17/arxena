import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useWebSocketEvent } from '../../modules/websocket-context/useWebSocketEvent';
import { useWebSocket } from '../../modules/websocket-context/WebSocketContextProvider';

const StyledButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const StyledButton = styled.button<{
  variant?: 'primary' | 'secondary';
  submitted?: boolean;
}>`
  background-color: ${({ variant, submitted, theme }) =>
    submitted
      ? theme.border.color.medium
      : variant === 'secondary'
        ? theme.background.tertiary
        : theme.color.blue};
  color: ${({ variant, submitted, theme }) =>
    submitted
      ? theme.font.color.secondary
      : variant === 'secondary'
        ? theme.font.color.primary
        : theme.font.color.inverted};
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid
    ${({ variant, submitted, theme }) =>
      submitted
        ? theme.border.color.medium
        : variant === 'secondary'
          ? theme.border.color.medium
          : theme.color.blue};
  cursor: ${({ submitted }) => (submitted ? 'not-allowed' : 'pointer')};

  &:hover {
    background-color: ${({ variant, submitted, theme }) =>
      submitted
        ? theme.border.color.medium
        : variant === 'secondary'
          ? theme.background.quaternary
          : theme.color.blue60};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const MetadataStructureSection = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [hasBeenClicked, setHasBeenClicked] = useState(() => {
    return localStorage.getItem('metadata-structure-created') === 'true';
  });
  const { connected, socket } = useWebSocket();
  const { enqueueSnackBar } = useSnackBar();

  console.log('MetadataStructureSection rendered, socket:', !!socket, 'connected:', connected);

  // Direct event handler using socket
  useEffect(() => {
    if (!socket) return;
    
    console.log('Setting up direct socket event listener for metadata-structure-progress');
    
    const handleProgressEvent = (data: any) => {
      console.log('Direct socket listener received:', data);
      
      if (data?.message) {
        let variant = SnackBarVariant.Info;
        
        if (data.step === 'candidate-view-updated') {
          variant = SnackBarVariant.Success;
        }
        
        if (data.step === 'metadata-structure-complete') {
          variant = SnackBarVariant.Success;
          enqueueSnackBar(data.message, { variant });
          
          // Give the snackbar time to display before reloading
          console.log('Reloading page in 3 seconds due to metadata-structure-complete event');
          setTimeout(() => {
            window.location.reload();
          }, 3000);
          return;
        }
        
        enqueueSnackBar(data.message, { variant });
      }
    };
    
    socket.on('metadata-structure-progress', handleProgressEvent);
    
    return () => {
      console.log('Cleaning up direct socket event listener');
      socket.off('metadata-structure-progress', handleProgressEvent);
    };
  }, [socket, enqueueSnackBar]);

  // Also keep the original hook for backup
  useWebSocketEvent<{ step: string; message: string }>(
    'metadata-structure-progress',
    (data: { step: string; message: string }) => {
      console.log('useWebSocketEvent hook received:', data);
      
      if (data?.message) {
        let variant = SnackBarVariant.Info;
        
        console.log('data::', data);
        console.log('data.step::', data.step);
        
        if (data.step === 'candidate-view-updated') {
          variant = SnackBarVariant.Success;
        }
        
        if (data.step === 'metadata-structure-complete') {
          variant = SnackBarVariant.Success;
          enqueueSnackBar(data.message, { variant });
          
          // Give the snackbar time to display before reloading
          console.log('Reloading page in 3 seconds due to metadata-structure-complete event');
          setTimeout(() => {
            window.location.reload();
          }, 3000);
          return;
        }
        
        enqueueSnackBar(data.message, { variant });
      }
    },
    []
  );

  useEffect(() => {
    if (connected) {
      enqueueSnackBar('Connected to server', { variant: SnackBarVariant.Info });
      console.log('WebSocket connected status changed to:', connected);
    }
  }, [connected, enqueueSnackBar]);

  const handleCreateStructure = async () => {
    if (isSubmitting || hasBeenClicked) return;
    setIsSubmitting(true);
    setHasBeenClicked(true);
    localStorage.setItem('metadata-structure-created', 'true');

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/create-metadata-structure`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to create metadata structure');
      }

      enqueueSnackBar('Started metadata structure creation process', {
        variant: SnackBarVariant.Info,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to create metadata structure: ${error.message}`
          : 'Failed to create metadata structure',
        {
          variant: SnackBarVariant.Error,
        },
      );
      setHasBeenClicked(false);
      localStorage.removeItem('metadata-structure-created');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStructure = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/workspace-modifications/update-metadata-structure`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update metadata structure');
      }

      enqueueSnackBar('Started metadata structure update process', {
        variant: SnackBarVariant.Info,
      });
    } catch (error) {
      enqueueSnackBar(
        error instanceof Error
          ? `Failed to update metadata structure: ${error.message}`
          : 'Failed to update metadata structure',
        {
          variant: SnackBarVariant.Error,
        },
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <StyledButtonContainer>
      <StyledButton
        onClick={handleCreateStructure}
        disabled={isSubmitting}
        submitted={hasBeenClicked && !isSubmitting}
      >
        {isSubmitting
          ? 'Creating...'
          : hasBeenClicked
            ? 'Creating Structure..'
            : 'Create Metadata Structure'}
      </StyledButton>
      <StyledButton
        onClick={handleUpdateStructure}
        disabled={isUpdating}
        variant="secondary"
      >
        {isUpdating ? 'Updating...' : 'Update Metadata Structure'}
      </StyledButton>
    </StyledButtonContainer>
  );
};
