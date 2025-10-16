import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import axios from 'axios';
import { useState } from 'react';
import QRCode from 'react-qr-code';
import { useRecoilState } from 'recoil';
import { Loader } from 'twenty-ui';
import { useBaileys } from '../contexts/BaileysContext';

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

const StyledSampleMessageButton = styled.button`
  background-color: #3b82f6;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;

  &:hover {
    background-color: #2563eb;
  }

  &:disabled {
    background-color: #2563eb;
    cursor: not-allowed;
    opacity: 0.7;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const StyledRestartButton = styled.button`
  background-color: #f59e0b;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;

  &:hover {
    background-color: #d97706;
  }

  &:disabled {
    background-color: #d97706;
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

const StyledRecruiterInfo = styled.div`
  margin-top: 16px;
  text-align: center;
  color: ${({ theme }) => theme.font.color.primary};
`;

export default function ChatWindow() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSendingSampleMessage, setIsSendingSampleMessage] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const { socket, qrCode, isWhatsappLoggedIn, recruiterDetails } = useBaileys();

  console.log("recruiterDetails::", recruiterDetails);
  const handleLogout = async () => {
    if (!socket) {
      enqueueSnackBar('WhatsApp socket connection not available', { variant: SnackBarVariant.Error });
      return;
    }

    try {
      setIsLoggingOut(true);
      console.log("process.env.REACT_APP_SERVER_BASE_URL for sending url::", process.env.REACT_APP_SERVER_BASE_URL);
      const url = `${process.env.REACT_APP_SERVER_BASE_URL}/baileys-whatsapp/logout`;
      const response = await axios.post(url, { 
        sessionId: tokenPair?.accessToken?.token,
        origin: window.location.origin 
      }, { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } });

      if (response.data.status === 'ok') {
        localStorage.setItem('whatsapp_logged_out', 'true');
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

  const handleSendSampleMessage = async () => {
    if (!tokenPair?.accessToken?.token) {
      enqueueSnackBar('Authentication token not available', { variant: SnackBarVariant.Error });
      return;
    }

    try {
      setIsSendingSampleMessage(true);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/send-baileys-message-to-self`,
        {},
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );

      if (response.data.status === 'success') {
        enqueueSnackBar('Sample message sent successfully!', { variant: SnackBarVariant.Success });
      } else {
        throw new Error(response.data.message || 'Failed to send sample message');
      }
    } catch (error) {
      console.error('Error sending sample message:', error);
      enqueueSnackBar('Failed to send sample message', { variant: SnackBarVariant.Error });
    } finally {
      setIsSendingSampleMessage(false);
    }
  };

  const handleRestartConnection = async () => {
    if (!tokenPair?.accessToken?.token) {
      enqueueSnackBar('Authentication token not available', { variant: SnackBarVariant.Error });
      return;
    }

    try {
      setIsRestarting(true);
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/baileys-whatsapp/restart-connection`,
        { 
          forceNewQR: false // Soft restart - preserve credentials
        },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );

      if (response.data.status === 'ok') {
        enqueueSnackBar('WhatsApp connection restarted successfully!', { variant: SnackBarVariant.Success });
      } else {
        throw new Error(response.data.message || 'Failed to restart WhatsApp connection');
      }
    } catch (error) {
      console.error('Error restarting WhatsApp connection:', error);
      enqueueSnackBar('Failed to restart WhatsApp connection', { variant: SnackBarVariant.Error });
    } finally {
      setIsRestarting(false);
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
              {recruiterDetails?.name && recruiterDetails?.id && (
                <StyledRecruiterInfo>
                  Connected as: {recruiterDetails.name} ID: {recruiterDetails.id}
                </StyledRecruiterInfo>
              )}
              <StyledLogoutButton onClick={handleLogout} disabled={isLoggingOut}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Disconnect WhatsApp
              </StyledLogoutButton>
              <StyledSampleMessageButton onClick={handleSendSampleMessage} disabled={isSendingSampleMessage}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  <path d="M13 8H7" />
                  <path d="M17 12H7" />
                </svg>
                {isSendingSampleMessage ? 'Sending...' : 'Send Sample Baileys Chat Message to Self'}
              </StyledSampleMessageButton>
              <StyledRestartButton onClick={handleRestartConnection} disabled={isRestarting}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6" />
                  <path d="M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                {isRestarting ? 'Restarting...' : 'Restart WhatsApp Connection'}
              </StyledRestartButton>
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
          <StyledMessage>Recruiter Details: {recruiterDetails?.name} {recruiterDetails?.id}</StyledMessage>
          {recruiterDetails?.name && recruiterDetails?.id && (
            <StyledRecruiterInfo>
              Connected as: {recruiterDetails.name} <br /> ID: {recruiterDetails.id}
            </StyledRecruiterInfo>
          )}
        </>
      );
    }

    return (
      <StyledLoaderContainer>
        <Loader />
        <StyledMessage>
          {isLoggingOut ? 'Preparing new QR code...' : 'Loading WhatsApp QR Code...'}
        </StyledMessage>
        <StyledLogoutButton onClick={handleLogout} disabled={isLoggingOut}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {isLoggingOut ? 'Logging out...' : 'Logout Existing Session'}
        </StyledLogoutButton>
        <StyledRestartButton onClick={handleRestartConnection} disabled={isRestarting}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6" />
            <path d="M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          {isRestarting ? 'Restarting...' : 'Restart WhatsApp Connection'}
        </StyledRestartButton>
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
        <img src="/images/placeholders/moving-image/empty_functions.png" alt="" />
      </StyledCenteredContent>
    </StyledContainer>
  );
}