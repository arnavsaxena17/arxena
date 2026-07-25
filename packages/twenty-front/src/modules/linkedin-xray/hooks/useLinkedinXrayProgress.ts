import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useEffect, useMemo, useRef, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type LinkedinXrayStatusEvent = {
  message: string;
  page?: number;
  engine?: 'google' | 'bing';
  candidatesCollectedSoFar?: number;
  searchProjectId?: string;
  heartbeat?: boolean;
  timestamp?: string;
};

export type LinkedinXrayPageResultsEvent = {
  page?: number;
  engine?: 'google' | 'bing';
  candidatesReceived?: number;
  totalCandidates?: number;
  totalPages?: number;
  fetchedPages?: number[];
  pagesByEngine?: Record<string, number[]>;
  strategyLabel?: string;
  searchProjectId?: string;
};

export type LinkedinXrayCandidateBatchEvent = {
  page?: number;
  engine?: 'google' | 'bing';
  candidates?: Array<Record<string, unknown>>;
  totalCandidatesSoFar?: number;
  fetchedPages?: number[];
  pagesByEngine?: Record<string, number[]>;
  searchProjectId?: string;
};

export type LinkedinXrayCompleteEvent = {
  message?: string;
  candidates?: Array<Record<string, unknown>>;
  totalCandidates?: number;
  pagesByEngine?: Record<string, number[]>;
  searchProjectId?: string;
};

export const useLinkedinXrayProgress = (enabled = true) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusEvents, setStatusEvents] = useState<LinkedinXrayStatusEvent[]>([]);
  const [pageResults, setPageResults] = useState<LinkedinXrayPageResultsEvent[]>([]);
  const [candidateBatches, setCandidateBatches] = useState<
    LinkedinXrayCandidateBatchEvent[]
  >([]);
  const [completedSearches, setCompletedSearches] = useState<
    LinkedinXrayCompleteEvent[]
  >([]);

  useEffect(() => {
    if (!enabled || !tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      return;
    }

    const url = new URL(
      `${REACT_APP_SERVER_BASE_URL}/linkedin-xray-progress/stream`,
    );
    url.searchParams.set('token', tokenPair.accessOrWorkspaceAgnosticToken.token);
    url.searchParams.set('origin', window.location.origin);

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as LinkedinXrayStatusEvent;
      if (data.heartbeat) {
        return;
      }
      setStatusEvents((prev) => [...prev, data]);
    });

    eventSource.addEventListener('pageResults', (event) => {
      const data = JSON.parse(
        (event as MessageEvent).data,
      ) as LinkedinXrayPageResultsEvent;
      setPageResults((prev) => [...prev, data]);
    });

    eventSource.addEventListener('candidateBatch', (event) => {
      const data = JSON.parse(
        (event as MessageEvent).data,
      ) as LinkedinXrayCandidateBatchEvent;
      setCandidateBatches((prev) => [...prev, data]);
    });

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as LinkedinXrayCompleteEvent;
      setCompletedSearches((prev) => [...prev, data]);
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { error?: string };
        setError(data.error || 'LinkedIn x-ray stream failed');
      } catch {
        setError('LinkedIn x-ray stream failed');
      }
    });

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  const flattenedCandidates = useMemo(
    () => candidateBatches.flatMap((batch) => batch.candidates || []),
    [candidateBatches],
  );

  return {
    isConnected,
    error,
    statusEvents,
    pageResults,
    candidateBatches,
    completedSearches,
    flattenedCandidates,
  };
};
