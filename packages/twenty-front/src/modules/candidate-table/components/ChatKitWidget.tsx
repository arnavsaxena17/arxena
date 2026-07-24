import { IconX } from 'twenty-ui/icons';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

const StyledChatKitContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: ${({ isOpen }) => (isOpen ? '400px' : '0')};
  height: ${({ isOpen }) => (isOpen ? '600px' : '0')};
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
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
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  min-height: 50px;
  flex-shrink: 0;
`;

const StyledChatTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background-color: transparent;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  color: ${({ theme }) => theme.font.color.secondary};
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.primary};
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
  const tokenPair = useRecoilValue(tokenPairState);
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

      if (!tokenPair?.accessToken?.token) {
        throw new Error('No authentication token available');
      }

      requestInProgressRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const serverBaseUrl = 
          window._env_?.REACT_APP_SERVER_BASE_URL ||
          process.env.REACT_APP_SERVER_BASE_URL ||
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`);
        
        console.log('[ChatKit] Requesting new session from:', `${serverBaseUrl}/candidate-sourcing/chatkit-session`);
        
        const response = await fetch(`${serverBaseUrl}/candidate-sourcing/chatkit-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenPair.accessToken.token}`,
          },
          body: JSON.stringify({
            workflowId: defaultWorkflowId,
            userId: userIdRef.current,
          }),
        });

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
    [tokenPair?.accessToken?.token, defaultWorkflowId, clientSecret]
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

