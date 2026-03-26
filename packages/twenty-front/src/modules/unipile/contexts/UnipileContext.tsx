import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { UnipileLinkedinAccount, UnipileWhatsappAccount } from 'twenty-shared';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  isLinkedinUnipileConnectedSelector,
  linkedinUnipileAccountsState,
} from '@/linkedin-unipile/states/linkedinUnipileAccountsState';
import {
  isWhatsappUnipileConnectedSelector,
  whatsappUnipileAccountsState,
} from '@/whatsapp-unipile/states/whatsappUnipileAccountsState';
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

const areAccountsEqual = <T,>(prev: T[], next: T[]) => {
  if (prev.length !== next.length) {
    return false;
  }

  for (let index = 0; index < prev.length; index += 1) {
    const prevAccount = prev[index];
    const nextAccount = next[index];

    if (JSON.stringify(prevAccount) !== JSON.stringify(nextAccount)) {
      return false;
    }
  }

  return true;
};

export const UnipileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
  const setLinkedinAccountsState = useSetRecoilState(
    linkedinUnipileAccountsState,
  );
  const setWhatsappAccountsState = useSetRecoilState(
    whatsappUnipileAccountsState,
  );
  const linkedinUnipileAccounts = useRecoilValue(linkedinUnipileAccountsState);
  const whatsappUnipileAccounts = useRecoilValue(whatsappUnipileAccountsState);
  const isLinkedinUnipileConnected = useRecoilValue(
    isLinkedinUnipileConnectedSelector,
  );
  const isWhatsappUnipileConnected = useRecoilValue(
    isWhatsappUnipileConnectedSelector,
  );
  const linkedinAccountsRef = useRef<UnipileLinkedinAccount[]>(
    linkedinUnipileAccounts,
  );
  const whatsappAccountsRef = useRef<UnipileWhatsappAccount[]>(
    whatsappUnipileAccounts,
  );
  const isRefreshingRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const refreshAccounts = useCallback(async () => {
    if (!accessToken) {
      pendingRefreshRef.current = false;
      isRefreshingRef.current = false;
      setLinkedinAccountsState([]);
      setWhatsappAccountsState([]);
      setLastUpdated(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (isRefreshingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    isRefreshingRef.current = true;
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

    if (
      linkedinResult.status === 'rejected' ||
      whatsappResult.status === 'rejected'
    ) {
      const linkedinError =
        linkedinResult.status === 'rejected' ? linkedinResult.reason : null;
      const whatsappError =
        whatsappResult.status === 'rejected' ? whatsappResult.reason : null;
      const errorMessages = [linkedinError, whatsappError]
        .filter(Boolean)
        .map((reason) =>
          reason instanceof Error ? reason.message : String(reason),
        );

      setError(
        errorMessages.join(' | ') || 'Failed to refresh Unipile accounts',
      );
    }

    if (
      linkedinResult.status === 'fulfilled' &&
      !areAccountsEqual(linkedinAccountsRef.current, nextLinkedinAccounts)
    ) {
      setLinkedinAccountsState(nextLinkedinAccounts);
    }
    if (
      whatsappResult.status === 'fulfilled' &&
      !areAccountsEqual(whatsappAccountsRef.current, nextWhatsappAccounts)
    ) {
      setWhatsappAccountsState(nextWhatsappAccounts);
    }
    if (
      linkedinResult.status === 'fulfilled' ||
      whatsappResult.status === 'fulfilled'
    ) {
      setLastUpdated(Date.now());
    }
    setIsLoading(false);
    isRefreshingRef.current = false;

    if (pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      refreshAccounts();
    }
  }, [accessToken, setLinkedinAccountsState, setWhatsappAccountsState]);

  useEffect(() => {
    if (accessToken != null && accessToken !== '') {
      refreshAccounts();
    } else {
      setLinkedinAccountsState([]);
      setWhatsappAccountsState([]);
      setIsLoading(false);
      setError(null);
      setLastUpdated(null);
    }
  }, [
    accessToken,
    refreshAccounts,
    setLinkedinAccountsState,
    setWhatsappAccountsState,
  ]);

  useEffect(() => {
    linkedinAccountsRef.current = linkedinUnipileAccounts;
  }, [linkedinUnipileAccounts]);

  useEffect(() => {
    whatsappAccountsRef.current = whatsappUnipileAccounts;
  }, [whatsappUnipileAccounts]);

  const contextValue = useMemo<UnipileContextValue>(
    () => ({
      isLinkedinConnected: isLinkedinUnipileConnected,
      isWhatsappUnipileConnected: isWhatsappUnipileConnected,
      linkedinAccounts: linkedinUnipileAccounts,
      whatsappAccounts: whatsappUnipileAccounts,
      isLoading,
      error,
      lastUpdated,
      refreshAccounts,
    }),
    [
      isLinkedinUnipileConnected,
      isWhatsappUnipileConnected,
      linkedinUnipileAccounts,
      whatsappUnipileAccounts,
      isLoading,
      error,
      lastUpdated,
      refreshAccounts,
    ],
  );

  return (
    <UnipileContext.Provider value={contextValue}>
      {children}
    </UnipileContext.Provider>
  );
};

export const useUnipile = () => useContext(UnipileContext);
