import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { io, Socket } from 'socket.io-client';

type BaileysContextType = {
  socket: Socket | null;
  qrCode: string;
  isWhatsappLoggedIn: boolean;
  recruiterDetails: { name: string; id: string } | null;
};

const BaileysContext = createContext<BaileysContextType>({
  socket: null,
  qrCode: '',
  isWhatsappLoggedIn: false,
  recruiterDetails: null,
});

export const BaileysProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [isWhatsappLoggedIn, setIsWhatsappLoggedIn] = useState(false);
  const [recruiterDetails, setRecruiterDetails] = useState<{ name: string; id: string } | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const { enqueueSnackBar } = useSnackBar();

  useEffect(() => {
    // Ensure we have all required data before connecting
    if (!tokenPair?.accessToken?.token || !currentWorkspaceMember?.id) {
      console.log('Missing required data for Baileys WebSocket connection:', {
        hasToken: !!tokenPair?.accessToken?.token,
        workspaceMemberId: currentWorkspaceMember?.id,
      });
      return;
    }

    const isLoggedOut = localStorage.getItem('whatsapp_logged_out') === 'true';
    if (isLoggedOut) {
      setIsWhatsappLoggedIn(false);
    }

    const url = new URL(window.location.href);
    const socketURL = url.origin.includes('localhost') ? 'http://localhost:3000' : url.origin;
    
    const newSocket = io(socketURL, {
      path: '/baileys-socket',
      query: {
        token: tokenPair.accessToken.token,
        origin: socketURL,
        workspaceMemberId: currentWorkspaceMember.id,
      },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('WhatsApp socket connected with ID:', newSocket.id, 'for workspaceMember:', currentWorkspaceMember.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WhatsApp socket disconnected, reason:', reason);
      if (reason === 'io server disconnect') {
        // Delay reconnection to prevent rapid reconnection attempts
        setTimeout(() => {
          newSocket.connect();
        }, 2000);
      }
      setIsWhatsappLoggedIn(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      if (error.message?.includes('unauthorized') || error.message?.includes('authentication failed')) {
        setIsWhatsappLoggedIn(false);
        localStorage.setItem('whatsapp_logged_out', 'true');
      }
    });

    newSocket.on('qr', (qr: string) => {
      console.log('Received WhatsApp QR code for workspaceMember:', currentWorkspaceMember.id);
      if (qr && qr.length > 0) {
        setQrCode(qr);
        setIsWhatsappLoggedIn(false);
        localStorage.setItem('whatsapp_logged_out', 'true');
      }
    });

    newSocket.on('isWhatsappLoggedIn', (status: boolean) => {
      console.log('WhatsApp connection status update for workspaceMember:', currentWorkspaceMember.id, 'status:', status);
      setIsWhatsappLoggedIn(status);
      if (status) {
        setQrCode('');
        localStorage.setItem('whatsapp_logged_out', 'false');
      }
    });

    newSocket.on('recruiterDetails', (details: { name: string; id: string }) => {
      console.log('Received recruiter details:', details, 'for workspaceMember:', currentWorkspaceMember.id);
      if (details && typeof details.name === 'string' && typeof details.id === 'string') {
        setRecruiterDetails(details);
      }
    });

    setSocket(newSocket);

    return () => {
      console.log('Cleaning up WhatsApp socket connection for workspaceMember:', currentWorkspaceMember.id);
      newSocket.off('qr');
      newSocket.off('isWhatsappLoggedIn');
      newSocket.off('recruiterDetails');
      newSocket.off('error');
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.disconnect();
    };
  }, [tokenPair?.accessToken?.token, currentWorkspaceMember?.id]);

  return (
    <BaileysContext.Provider
      value={{
        socket,
        qrCode,
        isWhatsappLoggedIn,
        recruiterDetails,
      }}
    >
      {children}
    </BaileysContext.Provider>
  );
};

export const useBaileys = () => useContext(BaileysContext); 