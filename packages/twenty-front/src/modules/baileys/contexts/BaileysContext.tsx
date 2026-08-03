import React, { createContext, useContext, useMemo } from 'react';
import { type Socket } from 'socket.io-client';

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

// Baileys socket gateway is not mounted in the Nest app; keep provider API but do not connect.
export const BaileysProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const connectionContextValue = useMemo(
    () => ({
      isBaileysLoggedIn: false,
    }),
    [],
  );

  const contextValue = useMemo(
    () => ({
      socket: null,
      qrCode: '',
      isBaileysLoggedIn: false,
      recruiterDetails: null,
    }),
    [],
  );

  return (
    <BaileysContext.Provider value={contextValue}>
      <BaileysConnectionContext.Provider value={connectionContextValue}>
        {children}
      </BaileysConnectionContext.Provider>
    </BaileysContext.Provider>
  );
};

export const useBaileys = () => useContext(BaileysContext);

export const useBaileysConnection = () => useContext(BaileysConnectionContext);
