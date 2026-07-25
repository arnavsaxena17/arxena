import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useEffect, useRef, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type AiFilteringProgressData = {
  step: string;
  message: string;
  progress_percentage?: number;
  total_records?: number;
  processed_records?: number;
  current_enrichment?: number;
  total_enrichments?: number;
  timestamp: string;
};

export const useAiFilteringProgress = () => {
  const [aiFilteringProgress, setAiFilteringProgress] = useState<AiFilteringProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);

  useEffect(() => {
    if (!tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      console.warn('No access token available for AI filtering progress streaming');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const url = new URL(`${REACT_APP_SERVER_BASE_URL}/ai-filtering-progress/stream`);
    url.searchParams.set('token', tokenPair.accessOrWorkspaceAgnosticToken.token);
    url.searchParams.set('origin', window.location.origin);
    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        let jsonData = event.data;
        if (jsonData.startsWith('data: ')) {
          jsonData = jsonData.substring(6);
        }
        const data = JSON.parse(jsonData);
        if (data.step === 'heartbeat') {
          return;
        }
        setAiFilteringProgress(data);
      } catch (parseError) {
        setError('Failed to parse progress data');
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection error');
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    aiFilteringProgress,
    isConnected,
    error,
    reconnect: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setError(null);
    }
  };
};
