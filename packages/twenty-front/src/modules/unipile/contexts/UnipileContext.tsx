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
import { linkedinUnipileOwnerProfileCacheState } from '@/orgchart/states/linkedinUnipileOwnerProfileCacheState';
import { orgChartLinkedInSearchTypeState } from '@/orgchart/states/orgChartLinkedInSearchTypeState';
import {
    isWhatsappUnipileConnectedSelector,
    whatsappUnipileAccountsState,
} from '@/whatsapp-unipile/states/whatsappUnipileAccountsState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

import { getLinkedinService } from '../../../pages/settings/linkedin/services/linkedin-backend.service';
import { getWhatsappUnipileService } from '../../../pages/settings/whatsapp/services/whatsapp-unipile-backend.service';
import { LinkedinUnipileVisibilityRecoveryEffect } from '../components/LinkedinUnipileVisibilityRecoveryEffect';
import { workspaceMemberProfileUnipileFieldsState } from '../states/workspaceMemberProfileUnipileFieldsState';
import {
    applyInferredOrgChartLinkedinSearchType,
    dispatchUnipileAccountsRefreshedEvent,
} from '../utils/applyInferredOrgChartLinkedinSearchType';
import {
    fetchUnipileConnectionStatus,
    tryExtensionLinkedinUnipileRecovery,
    type UnipileConnectionStatusResponse,
} from '../utils/linkedinUnipileExtensionBridge';
import { invalidateUnipileConnectionStatusCache } from '../utils/unipileConnectionStatusCache';

const REFRESH_MIN_INTERVAL_MS = 90_000;

const bootstrapPromises = new Map<string, Promise<void>>();

export type UnipileRefreshOptions = {
  force?: boolean;
};

type UnipileContextValue = {
  isLinkedinConnected: boolean;
  isWhatsappUnipileConnected: boolean;
  linkedinAccounts: UnipileLinkedinAccount[];
  whatsappAccounts: UnipileWhatsappAccount[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  memberConnectionStatus: UnipileConnectionStatusResponse | null;
  refreshAccounts: (
    options?: UnipileRefreshOptions,
  ) => Promise<UnipileConnectionStatusResponse | null>;
};

const defaultContextValue: UnipileContextValue = {
  isLinkedinConnected: false,
  isWhatsappUnipileConnected: false,
  linkedinAccounts: [],
  whatsappAccounts: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  memberConnectionStatus: null,
  refreshAccounts: async () => null,
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

const areConnectionStatusesEqual = (
  prev: UnipileConnectionStatusResponse | null,
  next: UnipileConnectionStatusResponse | null,
): boolean => {
  if (prev == null && next == null) {
    return true;
  }
  if (prev == null || next == null) {
    return false;
  }
  return JSON.stringify(prev) === JSON.stringify(next);
};

export const UnipileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token;
  const workspaceMemberProfileUnipileFields = useRecoilValue(
    workspaceMemberProfileUnipileFieldsState,
  );
  const setLinkedinAccountsState = useSetRecoilState(
    linkedinUnipileAccountsState,
  );
  const setWhatsappAccountsState = useSetRecoilState(
    whatsappUnipileAccountsState,
  );
  const setOrgChartLinkedInSearchType = useSetRecoilState(
    orgChartLinkedInSearchTypeState,
  );
  const setOwnerProfileCache = useSetRecoilState(
    linkedinUnipileOwnerProfileCacheState,
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
  const memberConnectionStatusRef = useRef<UnipileConnectionStatusResponse | null>(
    null,
  );
  const workspaceMemberProfileRef = useRef(workspaceMemberProfileUnipileFields);
  const isRefreshingRef = useRef(false);
  const refreshInFlightRef =
    useRef<Promise<UnipileConnectionStatusResponse | null> | null>(null);
  const pendingForceRefreshRef = useRef(false);
  const lastRefreshCompletedAtRef = useRef(0);
  const bootstrappedTokenRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [memberConnectionStatus, setMemberConnectionStatus] =
    useState<UnipileConnectionStatusResponse | null>(null);
  const [serverMemberLinkedinConnected, setServerMemberLinkedinConnected] =
    useState(false);
  const [serverMemberWhatsappConnected, setServerMemberWhatsappConnected] =
    useState(false);

  workspaceMemberProfileRef.current = workspaceMemberProfileUnipileFields;

  const refreshAccounts = useCallback(
    async (
      options?: UnipileRefreshOptions,
    ): Promise<UnipileConnectionStatusResponse | null> => {
      if (!accessToken) {
        pendingForceRefreshRef.current = false;
        isRefreshingRef.current = false;
        refreshInFlightRef.current = null;
        setLinkedinAccountsState([]);
        setWhatsappAccountsState([]);
        setServerMemberLinkedinConnected(false);
        setServerMemberWhatsappConnected(false);
        setMemberConnectionStatus(null);
        memberConnectionStatusRef.current = null;
        setLastUpdated(null);
        setError(null);
        setIsLoading(false);
        invalidateUnipileConnectionStatusCache();
        return null;
      }

      const now = Date.now();
      const force = options?.force === true;
      if (
        !force &&
        now - lastRefreshCompletedAtRef.current < REFRESH_MIN_INTERVAL_MS
      ) {
        return memberConnectionStatusRef.current;
      }

      if (refreshInFlightRef.current) {
        if (force) {
          pendingForceRefreshRef.current = true;
        }
        return refreshInFlightRef.current;
      }

      const runRefresh = async (): Promise<UnipileConnectionStatusResponse | null> => {
        if (isRefreshingRef.current) {
          return memberConnectionStatusRef.current;
        }

        isRefreshingRef.current = true;
        setIsLoading(true);
        setError(null);

        const baseUrl = REACT_APP_SERVER_BASE_URL?.replace(/\/$/, '') ?? '';
        if (force && baseUrl) {
          invalidateUnipileConnectionStatusCache(accessToken, baseUrl);
        }

        const linkedinService = getLinkedinService();
        const whatsappService = getWhatsappUnipileService();
        const memberLinkedinAccountId =
          workspaceMemberProfileRef.current?.linkedinUnipileAccountId?.trim() ??
          '';
        const skipWorkspaceLinkedinAccountsList =
          memberLinkedinAccountId.length > 0;

        const [linkedinResult, whatsappResult, memberStatusResult] =
          await Promise.allSettled([
            skipWorkspaceLinkedinAccountsList
              ? Promise.resolve([] as UnipileLinkedinAccount[])
              : linkedinService.getAllAccounts(accessToken),
            whatsappService.getAllAccounts(accessToken),
            baseUrl
              ? fetchUnipileConnectionStatus(accessToken, baseUrl, {
                  bypassCache: force,
                })
              : Promise.resolve(null),
          ]);

        const refreshedAt = Date.now();
        let memberStatus: UnipileConnectionStatusResponse | null = null;
        const previousMemberStatus = memberConnectionStatusRef.current;

        if (
          memberStatusResult.status === 'fulfilled' &&
          memberStatusResult.value != null
        ) {
          memberStatus = memberStatusResult.value;
          setServerMemberLinkedinConnected(memberStatus.linkedinConnected);
          setServerMemberWhatsappConnected(memberStatus.whatsappConnected);
          if (!areConnectionStatusesEqual(previousMemberStatus, memberStatus)) {
            setMemberConnectionStatus(memberStatus);
            memberConnectionStatusRef.current = memberStatus;
          }
        }

        const nextLinkedinAccounts: UnipileLinkedinAccount[] =
          linkedinResult.status === 'fulfilled'
            ? linkedinResult.value.filter((account) => account.type === 'LINKEDIN')
            : linkedinAccountsRef.current;

        if (memberStatus != null) {
          applyInferredOrgChartLinkedinSearchType({
            payload: {
              accountId:
                memberStatus.linkedinUnipileAccountId ??
                nextLinkedinAccounts[0]?.id,
              inferredSearchType: memberStatus.inferredSearchType,
              salesNavigatorAvailable: memberStatus.salesNavigatorAvailable,
              recruiterAvailable: memberStatus.recruiterAvailable,
              fetchedAt: refreshedAt,
            },
            setOrgChartLinkedInSearchType,
            setOwnerProfileCache,
          });
        }

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

        const linkedinAccountsChanged =
          linkedinResult.status === 'fulfilled' &&
          !areAccountsEqual(linkedinAccountsRef.current, nextLinkedinAccounts);
        const whatsappAccountsChanged =
          whatsappResult.status === 'fulfilled' &&
          !areAccountsEqual(whatsappAccountsRef.current, nextWhatsappAccounts);
        const memberStatusChanged =
          memberStatus != null &&
          !areConnectionStatusesEqual(previousMemberStatus, memberStatus);

        if (linkedinAccountsChanged) {
          setLinkedinAccountsState(nextLinkedinAccounts);
        }
        if (whatsappAccountsChanged) {
          setWhatsappAccountsState(nextWhatsappAccounts);
        }
        if (
          linkedinResult.status === 'fulfilled' ||
          whatsappResult.status === 'fulfilled' ||
          memberStatus != null
        ) {
          setLastUpdated(refreshedAt);
          lastRefreshCompletedAtRef.current = refreshedAt;
        }
        if (
          linkedinAccountsChanged ||
          whatsappAccountsChanged ||
          memberStatusChanged
        ) {
          dispatchUnipileAccountsRefreshedEvent();
        }
        setIsLoading(false);
        isRefreshingRef.current = false;

        return memberStatus;
      };

      const promise = runRefresh();
      refreshInFlightRef.current = promise;

      try {
        const memberStatus = await promise;

        if (pendingForceRefreshRef.current) {
          pendingForceRefreshRef.current = false;
          return refreshAccounts({ force: true });
        }

        return memberStatus;
      } finally {
        if (refreshInFlightRef.current === promise) {
          refreshInFlightRef.current = null;
        }
      }
    },
    [
      accessToken,
      setLinkedinAccountsState,
      setOrgChartLinkedInSearchType,
      setOwnerProfileCache,
      setWhatsappAccountsState,
    ],
  );

  const refreshAccountsRef = useRef(refreshAccounts);
  refreshAccountsRef.current = refreshAccounts;

  useEffect(() => {
    if (!accessToken?.trim()) {
      bootstrappedTokenRef.current = null;
      bootstrapPromises.delete(accessToken ?? '');
      setLinkedinAccountsState([]);
      setWhatsappAccountsState([]);
      setServerMemberLinkedinConnected(false);
      setServerMemberWhatsappConnected(false);
      setMemberConnectionStatus(null);
      memberConnectionStatusRef.current = null;
      setIsLoading(false);
      setError(null);
      setLastUpdated(null);
      invalidateUnipileConnectionStatusCache();
      return;
    }

    if (bootstrappedTokenRef.current === accessToken) {
      return;
    }
    bootstrappedTokenRef.current = accessToken;

    let existingBootstrap = bootstrapPromises.get(accessToken);
    if (!existingBootstrap) {
      existingBootstrap = (async () => {
        const baseUrl = REACT_APP_SERVER_BASE_URL?.replace(/\/$/, '') ?? '';
        if (baseUrl) {
          await tryExtensionLinkedinUnipileRecovery({
            accessToken,
            serverBaseUrl: baseUrl,
          });
        }
        await refreshAccountsRef.current();
      })().finally(() => {
        bootstrapPromises.delete(accessToken);
      });
      bootstrapPromises.set(accessToken, existingBootstrap);
    }

    void existingBootstrap;
  }, [accessToken, setLinkedinAccountsState, setWhatsappAccountsState]);

  useEffect(() => {
    linkedinAccountsRef.current = linkedinUnipileAccounts;
  }, [linkedinUnipileAccounts]);

  useEffect(() => {
    whatsappAccountsRef.current = whatsappUnipileAccounts;
  }, [whatsappUnipileAccounts]);

  const isLinkedinConnected =
    isLinkedinUnipileConnected || serverMemberLinkedinConnected;
  const isWhatsappConnected =
    isWhatsappUnipileConnected || serverMemberWhatsappConnected;

  const contextValue = useMemo<UnipileContextValue>(
    () => ({
      isLinkedinConnected,
      isWhatsappUnipileConnected: isWhatsappConnected,
      linkedinAccounts: linkedinUnipileAccounts,
      whatsappAccounts: whatsappUnipileAccounts,
      isLoading,
      error,
      lastUpdated,
      memberConnectionStatus,
      refreshAccounts,
    }),
    [
      isLinkedinConnected,
      isWhatsappConnected,
      linkedinUnipileAccounts,
      whatsappUnipileAccounts,
      isLoading,
      error,
      lastUpdated,
      memberConnectionStatus,
      refreshAccounts,
    ],
  );

  return (
    <UnipileContext.Provider value={contextValue}>
      <LinkedinUnipileVisibilityRecoveryEffect />
      {children}
    </UnipileContext.Provider>
  );
};

export const useUnipile = () => useContext(UnipileContext);
