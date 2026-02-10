import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useDebouncedCallback } from 'use-debounce';

import { tokenPairState } from '@/auth/states/tokenPairState';

export type CompanyAutocompleteItem = {
  name: string;
  meta: {
    id: string;
    website?: string;
    industry?: string;
    location_name?: string;
    linkedin_url?: string;
    employee_count?: number;
  };
  count: number;
};

export const useCompanyAutocomplete = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;

  const [companies, setCompanies] = useState<CompanyAutocompleteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(
    async (inputText: string) => {
      if (!inputText.trim()) {
        setCompanies([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${process.env.REACT_APP_SERVER_BASE_URL}/org-chart/companies/autocomplete`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken && {
                Authorization: `Bearer ${accessToken}`,
              }),
            },
            body: JSON.stringify({
              input_text: inputText.trim(),
              query: {},
              params: {},
            }),
          },
        );

        const data = (await response.json()) as {
          status?: string;
          result?: CompanyAutocompleteItem[];
        };

        console.log('pdl company autocomplete data', data);
        if (data?.status === 'ok' && Array.isArray(data.result)) {
          setCompanies(data.result);
        } else {
          setCompanies([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Autocomplete failed');
        setCompanies([]);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken],
  );

  const debouncedFetch = useDebouncedCallback(fetchCompanies, 300, {
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
    setCompanies([]);
    setError(null);
  }, [debouncedFetch]);

  return {
    companies,
    isLoading,
    error,
    search,
    clear,
  };
};
