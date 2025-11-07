import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import type { UnipileLinkedinAccount, UnipileWhatsappAccount } from 'twenty-shared';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { linkedinUnipileAccountsState } from '@/linkedin-unipile/states/linkedinUnipileAccountsState';
import { whatsappUnipileAccountsState } from '@/whatsapp-unipile/states/whatsappUnipileAccountsState';
// /Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-front/src/pages/settings/linkedin/services/linkedin-backend.service.ts
import { getLinkedinService } from '../../../pages/settings/linkedin/services/linkedin-backend.service';
import { getWhatsappUnipileService } from '../../../pages/settings/whatsapp/services/whatsapp-unipile-backend.service';
// import { getWhatsappUnipileService } from '../../../packages/twenty-front/src/pages/settings/whatsapp/services/whatsapp-unipile-backend.service';

type UnipileContextValue = {
  isLinkedinConnected: boolean;
  isWhatsappUnipileConnected: boolean;
  linkedinAccounts: UnipileLinkedinAccount[];
  whatsappAccounts: UnipileWhatsappAccount[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refreshAccounts: () => Promise<void>;
};

const defaultContextValue: UnipileContextValue = {
  isLinkedinConnected: false,
  isWhatsappUnipileConnected: false,
  linkedinAccounts: [],
  whatsappAccounts: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  refreshAccounts: async () => {},
};

const UnipileContext = createContext<UnipileContextValue>(defaultContextValue);

const REFRESH_INTERVAL_MS = 60_000;

export const UnipileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
  const setLinkedinAccountsState = useSetRecoilState(linkedinUnipileAccountsState);
  const setWhatsappAccountsState = useSetRecoilState(whatsappUnipileAccountsState);
  const linkedinAccounts = useRecoilValue(linkedinUnipileAccountsState);
  const whatsappAccounts = useRecoilValue(whatsappUnipileAccountsState);
  const linkedinAccountsRef = useRef<UnipileLinkedinAccount[]>(linkedinAccounts);
  const whatsappAccountsRef = useRef<UnipileWhatsappAccount[]>(whatsappAccounts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const refreshAccounts = useCallback(async () => {
    if (!accessToken) {
      setLinkedinAccountsState([]);
      setWhatsappAccountsState([]);
      setLastUpdated(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const linkedinService = getLinkedinService();
    const whatsappService = getWhatsappUnipileService();

    const [linkedinResult, whatsappResult] = await Promise.allSettled([
      linkedinService.getAllAccounts(accessToken),
      whatsappService.getAllAccounts(accessToken),
    ]);

    const nextLinkedinAccounts: UnipileLinkedinAccount[] =
      linkedinResult.status === 'fulfilled'
        ? linkedinResult.value.filter((account) => account.type === 'LINKEDIN')
        : linkedinAccountsRef.current;

    const nextWhatsappAccounts: UnipileWhatsappAccount[] =
      whatsappResult.status === 'fulfilled'
        ? whatsappResult.value.filter((account) => account.type === 'WHATSAPP')
        : whatsappAccountsRef.current;

    if (linkedinResult.status === 'rejected' || whatsappResult.status === 'rejected') {
      const linkedinError = linkedinResult.status === 'rejected' ? linkedinResult.reason : null;
      const whatsappError = whatsappResult.status === 'rejected' ? whatsappResult.reason : null;
      const errorMessages = [linkedinError, whatsappError]
        .filter(Boolean)
        .map((reason) => (reason instanceof Error ? reason.message : String(reason)));

      setError(errorMessages.join(' | ') || 'Failed to refresh Unipile accounts');
    }

    if (linkedinResult.status === 'fulfilled') {
      setLinkedinAccountsState(nextLinkedinAccounts);
    }
    if (whatsappResult.status === 'fulfilled') {
      setWhatsappAccountsState(nextWhatsappAccounts);
    }
    if (linkedinResult.status === 'fulfilled' || whatsappResult.status === 'fulfilled') {
      setLastUpdated(Date.now());
    }
    setIsLoading(false);
  }, [accessToken, setLinkedinAccountsState, setWhatsappAccountsState]);

  useEffect(() => {
    let intervalId: number | undefined;

    if (accessToken) {
      refreshAccounts();
      intervalId = window.setInterval(refreshAccounts, REFRESH_INTERVAL_MS);
    } else {
      setLinkedinAccountsState([]);
      setWhatsappAccountsState([]);
      setIsLoading(false);
      setError(null);
      setLastUpdated(null);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [accessToken, refreshAccounts, setLinkedinAccountsState, setWhatsappAccountsState]);

  useEffect(() => {
    linkedinAccountsRef.current = linkedinAccounts;
  }, [linkedinAccounts]);

  useEffect(() => {
    whatsappAccountsRef.current = whatsappAccounts;
  }, [whatsappAccounts]);

  const contextValue = useMemo<UnipileContextValue>(() => ({
    isLinkedinConnected: linkedinAccounts.some((account) => account.status === 'connected'),
    isWhatsappUnipileConnected: whatsappAccounts.some((account) => account.status === 'connected'),
    linkedinAccounts,
    whatsappAccounts,
    isLoading,
    error,
    lastUpdated,
    refreshAccounts,
  }), [linkedinAccounts, whatsappAccounts, isLoading, error, lastUpdated, refreshAccounts]);

  return (
    <UnipileContext.Provider value={contextValue}>
      {children}
    </UnipileContext.Provider>
  );
};

export const useUnipile = () => useContext(UnipileContext);


