import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import axios from 'axios';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useRecoilState } from 'recoil';
import { io } from 'socket.io-client';

const LogoutButton = styled.button`
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

  svg {
    width: 16px;
    height: 16px;
  }
`;

export default function ChatWindow() {
  const [qrCode, setQrCode] = useState('');
  const [isWhatsappLoggedIn, setIsWhatsappLoggedIn] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  
  
  console.log("qr code :", qrCode)
  console.log("is whatsapp logged in :", isWhatsappLoggedIn)
  console.log("token pair :", tokenPair)
  console.log("process.env.REACT_APP_SOCKET_PATH_FRONT::", process.env.REACT_APP_SERVER_BASE_URL)
  console.log("process.env.REACT_APP_SOCKET_PATH_FRONT::", process.env.REACT_APP_SERVER_BASE_URL)
  useEffect(() => {
    // Get just the origin (protocol + hostname + port) using URL parsing
    const url = new URL(window.location.href);
    let socketURL = url.origin;
      
    console.log("socketURL :", socketURL)
    console.log("window.location.origin :", window.location.origin)
    socketURL = socketURL.includes('localhost') ? 'http://localhost:3000' : socketURL;
    const socket = io(socketURL, {
      path: '/baileys-socket',
      query: {
        token: tokenPair?.accessToken?.token,
        origin: socketURL, // Use the clean origin here as well
      },
    });

    socket.on('connect', () => {
      console.log('Socket connected in chat window');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected in chat window'); 
    });

    socket.on('qr', (qr: any) => {
      console.log('Received QR code:', qr);
      setQrCode(qr);
    });

    socket.on('isWhatsappLoggedIn', (isWhatsappLoggedIn: boolean) => {
      console.log('Received isWhatsappLoggedIn:', isWhatsappLoggedIn);
      setIsWhatsappLoggedIn(isWhatsappLoggedIn);
    });

    return () => {
      socket.off('qr');
      socket.off('isWhatsappLoggedIn');
      socket.disconnect();
    };
  }, [tokenPair?.accessToken?.token]);



  const handleLogout = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/whatsapp/logout`,
        { 
          sessionId: tokenPair?.accessToken?.token,
          origin: window.location.origin 
        },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
      );

      if (response.data.status === 'ok') {
        enqueueSnackBar('Successfully logged out from WhatsApp', { variant: SnackBarVariant.Success });
        setIsWhatsappLoggedIn(false);
      } else {
        enqueueSnackBar('Failed to logout from WhatsApp', { variant: SnackBarVariant.Error });
      }
    } catch (error) {
      console.error('Error during logout:', error);
      enqueueSnackBar('Failed to logout from WhatsApp', { variant: SnackBarVariant.Error });
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1>WhatsApp QR Code</h1>
            {!isWhatsappLoggedIn ? (
              qrCode ? (
                <QRCode value={qrCode} />
              ) : (
                <p>Loading QR Code...</p>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <p>Your WhatsApp is logged in! Enjoy!</p>
                <LogoutButton onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout from WhatsApp
                </LogoutButton>
              </div>
            )}
          </div>
          <img src="/images/placeholders/moving-image/empty_inbox.png" alt="" />
        </div>
      </div>
    </>
  );
}