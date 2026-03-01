'use client';

import { ThemeProvider } from '@emotion/react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { trackGA4Event } from '@/lib/analytics';
import { trackWebsiteEvent } from '@/lib/mixpanel';

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
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 48, background: '#f5f5f5', borderRadius: 8 }} />
    ),
  },
);

type OrgChartSearchProps = {
  placeholder?: string;
  startIcon?: React.ReactNode;
};

export const OrgChartSearch = ({
  placeholder = "Search any company's org chart",
  startIcon,
}: OrgChartSearchProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const handleCompanySelect = (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  }) => {
    trackGA4Event('org_chart_search', {
      company_id: company.companyId,
      company_name: company.companyName,
    });
    trackWebsiteEvent('org_chart_search', {
      companyId: company.companyId,
      companyName: company.companyName,
    });
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
      placeholder={placeholder}
      baseUrl="/api/org-chart"
      autocompletePath="/autocomplete"
      logoBaseUrl="/api/org-chart/company-logo"
      startIcon={startIcon}
    />
  );
};
