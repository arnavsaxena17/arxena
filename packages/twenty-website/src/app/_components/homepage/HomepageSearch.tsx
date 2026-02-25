'use client';

import { ThemeProvider } from '@emotion/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

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

  const handleCompanySelect = (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  }) => {
    router.push(`/org-chart/${encodeURIComponent(company.companyId)}`);
  };

  return (
    <CompanySearchAutocomplete
      onCompanySelect={handleCompanySelect}
      placeholder="Search any company's org chart"
      baseUrl="/api/org-chart"
      autocompletePath="/autocomplete"
      logoBaseUrl="/api/org-chart/company-logo"
    />
  );
};
