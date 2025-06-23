import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useRecoilState } from 'recoil';
import { io, Socket } from 'socket.io-client';
import { Loader } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledCenteredContent = styled.div`
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
`;

const StyledTitle = styled.h1`
  margin-bottom: 24px;
`;

const StyledQRContainer = styled.div`
  margin-bottom: 2rem;
`;

const StyledMessage = styled.p`
  margin-top: 1rem;
`;

const StyledLogoutButton = styled.button`
  background-color: #ef4444;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background-color: #dc2626;
  }

  &:disabled {
    background-color: #dc2626;
    cursor: not-allowed;
    opacity: 0.7;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const StyledLoaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const StyledLoggedInContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

export default function ChatWindow() {
  const [qrCode, setQrCode] = useState('');
  const [isWhatsappLoggedIn, setIsWhatsappLoggedIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  
  const setupSocket = useCallback(() => {
    const isLoggedOut = localStorage.getItem('whatsapp_logged_out') === 'true';
    if (isLoggedOut) {
      console.log('WhatsApp is logged out, setting isWhatsappLoggedIn to false');
      setIsWhatsappLoggedIn(false);
    }

    const url = new URL(window.location.href);
    const socketURL = url.origin.includes('localhost') ? 'http://localhost:3000' : url.origin;

    console.log('Initializing WhatsApp socket connection to:', socketURL);
    
    const newSocket = io(socketURL, {
      path: '/baileys-socket',
      query: {
        token: tokenPair?.accessToken?.token,
        origin: socketURL,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('WhatsApp socket connected with ID:', newSocket.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WhatsApp socket disconnected, reason:', reason, 'was connected with ID:', newSocket.id);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try reconnecting
        console.log('Server initiated disconnect, attempting to reconnect...');
        newSocket.connect();
      }
      setIsWhatsappLoggedIn(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      // Don't set logged out state on connection errors, as we want to retry
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      // Only set logged out if it's a fatal error
      if (error.message?.includes('unauthorized') || error.message?.includes('authentication failed')) {
        setIsWhatsappLoggedIn(false);
        localStorage.setItem('whatsapp_logged_out', 'true');
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Socket reconnection attempt', attemptNumber);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after all attempts');
      enqueueSnackBar('Failed to connect to WhatsApp server. Please refresh the page.', {
        variant: SnackBarVariant.Error,
      });
    });

    newSocket.on('qr', (qr: string) => {
      console.log('Received WhatsApp QR code event. QR exists:', !!qr, 'Length:', qr?.length || 0);
      if (qr && qr.length > 0) {
        setQrCode(qr);
        setIsWhatsappLoggedIn(false);
        localStorage.setItem('whatsapp_logged_out', 'true');
      } else {
        console.log('Received empty QR code, waiting for valid QR...');
      }
    });

    newSocket.on('isWhatsappLoggedIn', (status: boolean) => {
      console.log('WhatsApp connection status update:', status);
      setIsWhatsappLoggedIn(status);
      if (status) {
        setQrCode('');
        localStorage.setItem('whatsapp_logged_out', 'false');
      }
    });

    return newSocket;
  }, [tokenPair?.accessToken?.token, enqueueSnackBar]);

  useEffect(() => {
    const newSocket = setupSocket();
    if (newSocket) {
      setSocket(newSocket);
      return () => {
        console.log('Cleaning up WhatsApp socket connection');
        newSocket.off('qr');
        newSocket.off('isWhatsappLoggedIn');
        newSocket.disconnect();
      };
    }
  }, [setupSocket]);

  const handleLogout = async () => {
    if (!socket) {
      enqueueSnackBar('WhatsApp socket connection not available', { variant: SnackBarVariant.Error });
      return;
    }

    try {
      setIsLoggingOut(true);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/baileys-whatsapp/logout`,
        { 
          sessionId: tokenPair?.accessToken?.token,
          origin: window.location.origin 
        },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );

      if (response.data.status === 'ok') {
        localStorage.setItem('whatsapp_logged_out', 'true');
        setIsWhatsappLoggedIn(false);
        setQrCode('');
        enqueueSnackBar('Successfully logged out from WhatsApp', { variant: SnackBarVariant.Success });
      } else {
        throw new Error(response.data.message || 'WhatsApp logout failed');
      }
    } catch (error) {
      console.error('Error during WhatsApp logout:', error);
      enqueueSnackBar('Failed to logout from WhatsApp', { variant: SnackBarVariant.Error });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const renderContent = () => {
    if (isWhatsappLoggedIn) {
      return (
        <StyledLoggedInContainer>
          {isLoggingOut ? (
            <StyledLoaderContainer>
              <Loader />
              <StyledMessage>Logging out from WhatsApp...</StyledMessage>
            </StyledLoaderContainer>
          ) : (
            <>
              <StyledMessage>Your WhatsApp is connected! Enjoy!</StyledMessage>
              <StyledLogoutButton onClick={handleLogout} disabled={isLoggingOut}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Disconnect WhatsApp
              </StyledLogoutButton>
            </>
          )}
        </StyledLoggedInContainer>
      );
    }

    if (qrCode) {
      return (
        <>
          <QRCode value={qrCode} />
          <StyledMessage>Scan this QR code with WhatsApp to connect</StyledMessage>
        </>
      );
    }

    return (
      <StyledLoaderContainer>
        <Loader />
        <StyledMessage>
          {isLoggingOut ? 'Preparing new QR code...' : 'Loading WhatsApp QR Code...'}
        </StyledMessage>
      </StyledLoaderContainer>
    );
  };

  return (
    <StyledContainer>
      <StyledCenteredContent>
        <StyledQRContainer>
          <StyledTitle>Connect WhatsApp</StyledTitle>
          {renderContent()}
        </StyledQRContainer>
        <img src="/images/placeholders/moving-image/empty_inbox.png" alt="" />
      </StyledCenteredContent>
    </StyledContainer>
  );
}