import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

type BaileysContextType = {
  socket: Socket | null;
  qrCode: string;
  isBaileysLoggedIn: boolean;
  recruiterDetails: { name: string; id: string } | null;
};

type BaileysConnectionContextType = {
  isBaileysLoggedIn: boolean;
};

const BaileysContext = createContext<BaileysContextType>({
  socket: null,
  qrCode: '',
  isBaileysLoggedIn: false,
  recruiterDetails: null,
});

const BaileysConnectionContext = createContext<BaileysConnectionContextType>({
  isBaileysLoggedIn: false,
});

export const BaileysProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [isBaileysLoggedIn, setIsBaileysLoggedIn] = useState(false);
  const [recruiterDetails, setRecruiterDetails] = useState<{ name: string; id: string } | null>(null);
  const [tokenPair] = useAtomState(tokenPairState);
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const qrCodeRef = useRef<string>('');

  useEffect(() => {
    // Ensure we have all required data before connecting
    if (!tokenPair?.accessToken?.token || !currentWorkspaceMember?.id) {
      console.log('Missing required data for Baileys WebSocket connection:', {
        hasToken: !!tokenPair?.accessToken?.token,
        workspaceMemberId: currentWorkspaceMember?.id,
        workspaceMemberName: currentWorkspaceMember?.name,
      });
      return;
    }

    const isLoggedOut = localStorage.getItem('whatsapp_logged_out') === 'true';
    console.log('Initial localStorage whatsapp_logged_out:', isLoggedOut);
    if (isLoggedOut) {
      setIsBaileysLoggedIn(false);
      setQrCode(''); // Clear any existing QR code
      qrCodeRef.current = '';
    } else {
      // Don't set initial state based on localStorage if not explicitly logged out
      // Let the server connection status determine the state
      console.log('Not explicitly logged out, waiting for server connection status');
    }

    const url = new URL(window.location.href);
    const socketURL = url.origin.includes('localhost') ? 'http://localhost:3000' : "https://app.arxena.com";
    
    const newSocket = io(socketURL, {
      query: {
        token: tokenPair.accessToken.token,
        origin: socketURL,
        workspaceMemberId: currentWorkspaceMember.id,
        workspaceMemberName: currentWorkspaceMember.name.firstName + ' ' + currentWorkspaceMember.name.lastName,
      },
      path: '/baileys-socket',
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
      setIsBaileysLoggedIn(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      if (error.message?.includes('unauthorized') || error.message?.includes('authentication failed')) {
        setIsBaileysLoggedIn(false);
        localStorage.setItem('whatsapp_logged_out', 'true');
      }
    });

    newSocket.on('qr', (qr: string) => {
      console.log('Received WhatsApp QR code for workspaceMember:', currentWorkspaceMember.id, 'QR length:', qr?.length);
      if (qr && qr.length > 0) {
        // Only update state if QR code is different to prevent unnecessary re-renders
        if (qrCodeRef.current !== qr) {
          qrCodeRef.current = qr;
          setQrCode(qr);
          // QR codes can be sent during reconnection, so we should handle them gracefully
          // Set localStorage to indicate we need to show QR, but don't force disconnect if already connected
          localStorage.setItem('whatsapp_logged_out', 'true');
          console.log('QR code received and stored');
        } else {
          console.log('QR code unchanged, skipping state update');
        }
      }
    });

    newSocket.on('isWhatsappLoggedIn', (status: boolean) => {
      console.log('WhatsApp connection status update for workspaceMember:', currentWorkspaceMember.id, 'status:', status);
      console.log('Previous status was:', isBaileysLoggedIn, 'new status:', status);
      setIsBaileysLoggedIn(prevStatus => {
        const newStatus = prevStatus !== status ? status : prevStatus;
        console.log('Setting isBaileysLoggedIn to:', newStatus);
        return newStatus;
      });
      if (status) {
        if (qrCodeRef.current) {
          qrCodeRef.current = '';
          setQrCode('');
        }
        localStorage.setItem('whatsapp_logged_out', 'false');
        console.log('Connection successful, cleared QR code and set localStorage to false');
      }
    });

    newSocket.on('recruiterDetails', (details: { name: string; id: string }) => {
      console.log('Received recruiter details:', details, 'for workspaceMember:', currentWorkspaceMember.id);
      if (details && typeof details.name === 'string' && typeof details.id === 'string') {
        setRecruiterDetails(prevDetails => 
          !prevDetails || prevDetails.name !== details.name || prevDetails.id !== details.id 
            ? details 
            : prevDetails
        );
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

  // Memoize connection status separately to prevent rerenders when only QR code changes
  const connectionContextValue = useMemo(() => ({
    isBaileysLoggedIn,
  }), [isBaileysLoggedIn]);

  // Memoize full context value (includes QR code for components that need it)
  const contextValue = useMemo(() => ({
    socket,
    qrCode,
    isBaileysLoggedIn,
    recruiterDetails,
  }), [socket, qrCode, isBaileysLoggedIn, recruiterDetails]);

  return (
    <BaileysContext.Provider value={contextValue}>
      <BaileysConnectionContext.Provider value={connectionContextValue}>
        {children}
      </BaileysConnectionContext.Provider>
    </BaileysContext.Provider>
  );
};

export const useBaileys = () => useContext(BaileysContext);

// Hook for components that only need connection status (prevents rerenders on QR code updates)
export const useBaileysConnection = () => useContext(BaileysConnectionContext); 