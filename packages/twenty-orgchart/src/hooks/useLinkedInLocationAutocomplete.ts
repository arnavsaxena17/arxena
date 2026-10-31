import { useCallback, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import type { OrgChartCompanyAutocompleteSource } from '../types/orgChartCompanyAutocompleteSource';

export type LinkedInLocationAutocompleteItem = {
  id: string;
  title: string;
};

export type UseLinkedInLocationAutocompleteOptions = {
  baseUrl: string;
  accessToken?: string;
  linkedinUnipileAccountId?: string;
  autocompletePath?: string;
};

export const useLinkedInLocationAutocomplete = (
  options: UseLinkedInLocationAutocompleteOptions,
) => {
  const {
    baseUrl,
    accessToken,
    linkedinUnipileAccountId,
    autocompletePath = '/org-chart/linkedin/locations/autocomplete',
  } = options;

  const [locations, setLocations] = useState<LinkedInLocationAutocompleteItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(
    async (inputText: string) => {
      if (!inputText.trim()) {
        setLocations([]);
        return;
      }

      if (!accessToken?.trim()) {
        setError('Sign in required');
        setLocations([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const path = autocompletePath.startsWith('/')
          ? autocompletePath
          : `/${autocompletePath}`;
        const params = new URLSearchParams({
          keywords: inputText.trim(),
          limit: '10',
        });
        if (linkedinUnipileAccountId?.trim()) {
          params.set('linkedin_unipile_account_id', linkedinUnipileAccountId.trim());
        }

        const url = `${baseUrl.replace(/\/$/, '')}${path}?${params.toString()}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const data = (await response.json()) as {
          status?: string;
          result?: LinkedInLocationAutocompleteItem[];
        };

        if (data?.status === 'ok' && Array.isArray(data.result)) {
          setLocations(data.result);
        } else {
          setLocations([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Location search failed');
        setLocations([]);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, autocompletePath, baseUrl, linkedinUnipileAccountId],
  );

  const debouncedFetch = useDebouncedCallback(fetchLocations, 300, {
    leading: false,
    trailing: true,
  });

  const search = useCallback(
    (inputText: string) => {
      if (inputText.trim()) {
        setIsLoading(true);
      }
      debouncedFetch(inputText);
    },
    [debouncedFetch],
  );

  const clear = useCallback(() => {
    debouncedFetch.cancel();
    setIsLoading(false);
    setLocations([]);
    setError(null);
  }, [debouncedFetch]);

  return {
    locations,
    isLoading,
    error,
    search,
    clear,
  };
};

export type { OrgChartCompanyAutocompleteSource };
