'use client';

import { ThemeProvider } from '@emotion/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const CompanySearchAutocomplete = dynamic(
  () =>
    import('@/lib/company-search').then((mod) => {
      const { CompanySearchAutocomplete: Search, companySearchLightTheme } =
        mod;
      return function CompanySearchWithTheme(
        props: Parameters<typeof Search>[0],
      ) {
        return (
          <ThemeProvider theme={companySearchLightTheme}>
            <Search {...props} />
          </ThemeProvider>
        );
      };
    }),
  { ssr: false },
);

export const HomepageSearch = () => {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleCompanySelect = (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  }) => {
    setIsNavigating(true);
    const params = new URLSearchParams();
    if (company.companyName) params.set('companyName', company.companyName);
    if (company.website) params.set('website', company.website);
    const query = params.toString();
    const path = `/org-chart/${encodeURIComponent(company.companyId)}${query ? `?${query}` : ''}`;
    router.push(path);
  };

  return (
    <CompanySearchAutocomplete
      onCompanySelect={handleCompanySelect}
      isSelecting={isNavigating}
      placeholder="Search any company's org chart"
      baseUrl="/api/org-chart"
      autocompletePath="/autocomplete"
      logoBaseUrl="/api/org-chart/company-logo"
    />
  );
};
