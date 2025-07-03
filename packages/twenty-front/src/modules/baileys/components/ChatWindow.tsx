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
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const { socket, qrCode, isWhatsappLoggedIn, recruiterDetails } = useBaileys();

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