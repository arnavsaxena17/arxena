import { tokenPairState } from '@/auth/states/tokenPairState';
import { resolveWarmPaths } from '@/candidate-table/services/warm-paths-api.service';
import type { WarmPathResolveResponse } from '@/candidate-table/types/warm-path.types';
import {
  getCandidateProfileUrl,
  isLinkedinProfileUrl,
} from '@/candidate-table/utils/getCandidateProfileUrl';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export type UseWarmPathResolveResult = {
  data: WarmPathResolveResponse | null;
  isLoading: boolean;
  error: string | null;
  linkedinUrl: string | null;
  hasLinkedinUrl: boolean;
  resolve: () => Promise<void>;
};

export const useWarmPathResolve = (
  candidateData: unknown,
): UseWarmPathResolveResult => {
  const tokenPair = useRecoilValue(tokenPairState);
  const [data, setData] = useState<WarmPathResolveResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedinUrl = getCandidateProfileUrl(candidateData);
  const hasLinkedinUrl =
    linkedinUrl.length > 0 && isLinkedinProfileUrl(linkedinUrl);

  useEffect(() => {
    setData(null);
    setError(null);
  }, [linkedinUrl]);

  const resolve = useCallback(async () => {
    const accessToken = tokenPair?.accessToken?.token;
    const baseUrl = process.env.REACT_APP_SERVER_BASE_URL;

    if (!hasLinkedinUrl) {
      setError('Add a LinkedIn profile URL to find warm paths.');
      setData(null);
      return;
    }

    if (!accessToken || !baseUrl) {
      setError('Sign in required to resolve warm paths.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await resolveWarmPaths(baseUrl, accessToken, {
        targetLinkedinUrl: linkedinUrl,
        maxBridges: 15,
        expandViewerConnectors: true,
      });
      setData(result);
    } catch (resolveError) {
      setData(null);
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : 'Failed to resolve warm paths',
      );
    } finally {
      setIsLoading(false);
    }
  }, [hasLinkedinUrl, linkedinUrl, tokenPair?.accessToken?.token]);

  return {
    data,
    isLoading,
    error,
    linkedinUrl: linkedinUrl || null,
    hasLinkedinUrl,
    resolve,
  };
};
