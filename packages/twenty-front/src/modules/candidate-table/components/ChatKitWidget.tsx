import { IconX } from 'twenty-ui/icon';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledChatKitContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: ${({ isOpen }) => (isOpen ? '400px' : '0')};
  height: ${({ isOpen }) => (isOpen ? '600px' : '0')};
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  z-index: 1001;
  transition: all 200ms ease;
  overflow: hidden;
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  flex-direction: column;
`;

const StyledChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  min-height: 50px;
  flex-shrink: 0;
`;

const StyledChatTitle = styled.div`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background-color: transparent;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  color: ${themeCssVariables.font.color.secondary};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledChatContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

type ChatKitWidgetProps = {
  isOpen: boolean;
  onClose: () => void;
  workflowId?: string;
};

export const ChatKitWidget = ({ isOpen, onClose, workflowId }: ChatKitWidgetProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const requestInProgressRef = useRef(false);
  const userIdRef = useRef<string>(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Default workflow ID - you can replace this with your actual workflow ID
  const defaultWorkflowId = workflowId || 'wf_68ec8f6622508190acceaaa5a39b2cfc00d4b2f2f4555e5d';

  const getClientSecret = useCallback(
    async (currentClientSecret: string | null) => {
      // If ChatKit provides an existing client secret, use it
      if (currentClientSecret) {
        console.log('[ChatKit] Using provided client secret');
        return currentClientSecret;
      }

      // If we already have a cached client secret in state, use it
      if (clientSecret) {
        console.log('[ChatKit] Using cached client secret from state');
        return clientSecret;
      }

      // Prevent duplicate requests
      if (requestInProgressRef.current) {
        console.log('[ChatKit] Request already in progress, waiting...');
        // Wait a bit and return cached secret if available
        await new Promise(resolve => setTimeout(resolve, 100));
        if (clientSecret) {
          return clientSecret;
        }
        return '';
      }

      if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
        throw new Error('No authentication token available');
      }

      requestInProgressRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        console.log(
          '[ChatKit] Requesting new session from:',
          `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/chatkit-session`,
        );

        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/chatkit-session`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`,
            },
            body: JSON.stringify({
              workflowId: defaultWorkflowId,
              userId: userIdRef.current,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[ChatKit] Session response:', data);

        if (data.status === 'Success' && data.client_secret) {
          setClientSecret(data.client_secret);
          return data.client_secret;
        } else {
          throw new Error(data.message || data.error || 'Failed to create ChatKit session');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to initialize chat';
        setError(errorMessage);
        console.error('[ChatKit] Error getting client secret:', err);
        throw err;
      } finally {
        requestInProgressRef.current = false;
        setIsLoading(false);
      }
    },
    [tokenPair?.accessOrWorkspaceAgnosticToken?.token, defaultWorkflowId, clientSecret]
  );

  // Initialize ChatKit - component only renders when isOpen is true
  const { control } = useChatKit({
    api: {
      getClientSecret,
    },
    theme: {
      colorScheme: 'light',
      color: {
        accent: {
          primary: '#2D8CFF',
          level: 2,
        },
      },
      radius: 'round',
      density: 'compact',
    },
    composer: {
      placeholder: 'Ask anything about your candidates...',
    },
    startScreen: {
      greeting: 'Welcome! How can I help you with your recruitment today?',
    },
  });

  useEffect(() => {
    // Reset when closed
    if (!isOpen) {
      initializedRef.current = false;
      setClientSecret(null);
      setError(null);
      requestInProgressRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <StyledChatKitContainer isOpen={isOpen}>
      <StyledChatHeader>
        <StyledChatTitle>AI Assistant</StyledChatTitle>
        <StyledCloseButton onClick={onClose} title="Close">
          <IconX size={16} />
        </StyledCloseButton>
      </StyledChatHeader>
      <StyledChatContent>
        {error ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
            <p>Error: {error}</p>
            <button
              onClick={() => {
                setError(null);
                getClientSecret(null);
              }}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#2D8CFF',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Loading chat...</p>
          </div>
        ) : control ? (
          <ChatKit key="chatkit-instance" control={control} className="h-full w-full" />
        ) : (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Initializing chat...</p>
          </div>
        )}
      </StyledChatContent>
    </StyledChatKitContainer>
  );
};

