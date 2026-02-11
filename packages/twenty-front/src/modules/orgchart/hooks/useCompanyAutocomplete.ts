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
    linkedin_slug?: string;
    display_name?: string;
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

export type CompanyInfoFromPdl = {
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  employeeCount?: number;
  linkedinDisplayName?: string;
};

export const useCompanyInfoLookup = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;

  const [company, setCompany] = useState<CompanyInfoFromPdl | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupByName = useCallback(
    async (inputText: string) => {
      const trimmed = inputText.trim();
      if (!trimmed) {
        setCompany(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('pdl lookupByName', trimmed);
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
              input_text: trimmed,
              query: {},
              params: {},
            }),
          },
        );

        console.log('pdl lookupByName response', response);
        const data = (await response.json()) as {
          status?: string;
          result?: CompanyAutocompleteItem[];
        };

        if (data?.status === 'ok' && Array.isArray(data.result)) {
          const exactOrFirst =
            data.result.find(
              (item) =>
                item.name.trim().toLowerCase() === trimmed.toLowerCase(),
            ) ?? data.result[0];

          if (exactOrFirst) {
            const slug = exactOrFirst.meta.linkedin_slug;
            const urlFromSlug = slug
              ? `https://www.linkedin.com/company/${slug}/`
              : undefined;

            setCompany({
              companyId: exactOrFirst.meta.id,
              companyName: exactOrFirst.name,
              website: exactOrFirst.meta.website,
              locationName: exactOrFirst.meta.location_name,
              industry: exactOrFirst.meta.industry,
              profileCount: exactOrFirst.count,
              linkedinUrl: exactOrFirst.meta.linkedin_url ?? urlFromSlug,
              employeeCount: exactOrFirst.meta.employee_count,
              linkedinDisplayName: exactOrFirst.meta.display_name,
            });
          } else {
            setCompany(null);
          }
        } else {
          setCompany(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Company lookup failed');
        setCompany(null);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken],
  );

  return {
    company,
    isLoading,
    error,
    lookupByName,
  };
};
