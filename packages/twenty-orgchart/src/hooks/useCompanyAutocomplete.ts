import { useCallback, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

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

export type UseCompanyAutocompleteOptions = {
  /** Base URL for API (e.g. https://server.com or /api/org-chart for proxy) */
  baseUrl: string;
  accessToken?: string;
  /** Path to autocomplete endpoint. Default: /org-chart/companies/autocomplete (append to baseUrl). Use /autocomplete for Next.js proxy. */
  autocompletePath?: string;
};

export const useCompanyAutocomplete = (options: UseCompanyAutocompleteOptions) => {
  const {
    baseUrl,
    accessToken,
    autocompletePath = '/org-chart/companies/autocomplete',
  } = options;

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
        const path = autocompletePath.startsWith('/') ? autocompletePath : `/${autocompletePath}`;
        const autocompleteUrl = `${baseUrl.replace(/\/$/, '')}${path}`;
        const response = await fetch(autocompleteUrl, {
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
        });

        const data = (await response.json()) as {
          status?: string;
          result?: CompanyAutocompleteItem[];
        };

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
    [baseUrl, accessToken, autocompletePath],
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

export const useCompanyInfoLookup = (options: UseCompanyAutocompleteOptions) => {
  const {
    baseUrl,
    accessToken,
    autocompletePath = '/org-chart/companies/autocomplete',
  } = options;

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
        const path = autocompletePath.startsWith('/') ? autocompletePath : `/${autocompletePath}`;
        const autocompleteUrl = `${baseUrl.replace(/\/$/, '')}${path}`;
        const response = await fetch(autocompleteUrl, {
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
        });

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
    [baseUrl, accessToken, autocompletePath],
  );

  return {
    company,
    isLoading,
    error,
    lookupByName,
  };
};
