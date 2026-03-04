import { Metadata } from 'next';
import Link from 'next/link';

import { fromSlug } from 'twenty-shared';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { getExposedBatchCount, getMaxExposedUrlCount } from '@/lib/sitemap';

import {
    BreadcrumbListSchema,
    BreadcrumbNav,
} from '@/app/_components/BreadcrumbList';
import { CompaniesPagination } from '@/app/_components/CompaniesPagination';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

import { fetchCompaniesByCountryAndType } from '../page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string; segment2: string; page: string }>;
}): Promise<Metadata> {
  const { segment, segment2, page } = await params;
  const pageNum = parseInt(page, 10);
  if (Number.isNaN(pageNum) || pageNum < 1) {
    return { title: 'Companies | Arxena' };
  }
  const countryName = fromSlug(segment.replace(/_/g, '-'));
  const typeName = fromSlug(segment2.replace(/_/g, '-'));
  return {
    title: `${countryName} ${typeName} Org Charts - Page ${pageNum} | Arxena`,
    description: `Browse ${typeName} org charts of companies in ${countryName}. Page ${pageNum}.`,
    alternates: { canonical: `/companies/${segment}/${segment2}/${pageNum}` },
  };
}

export default async function CompaniesCountryFunctionPagePage({
  params,
}: {
  params: Promise<{ segment: string; segment2: string; page: string }>;
}) {
  const { segment, segment2, page } = await params;
  const country = segment;
  const functionRoot = segment2;
  const pageNum = parseInt(page, 10);
  if (Number.isNaN(pageNum) || pageNum < 1) {
    return (
      <>
        <Header
          showSearch={false}
          signInUrl={getSignInUrl()}
          signUpUrl={getSignUpUrl()}
        />
        <ContentContainer>
          <div
            style={{
              padding: '48px 32px',
              maxWidth: 900,
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            <h1>Invalid page</h1>
            <Link href={`/companies/${country}/${functionRoot}`}>
              Back to {fromSlug(functionRoot.replace(/_/g, '-'))}
            </Link>
          </div>
        </ContentContainer>
      </>
    );
  }

  const maxExposedCount = getMaxExposedUrlCount(getExposedBatchCount());
  const { companyIds, hasMore } = await fetchCompaniesByCountryAndType(
    country,
    functionRoot,
    pageNum,
    maxExposedCount || undefined,
  );

  const baseUrl = await getBaseUrl();
  const countryName = fromSlug(country.replace(/_/g, '-'));
  const typeName = fromSlug(functionRoot.replace(/_/g, '-'));

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Companies', url: '/companies' },
    { name: countryName, url: `/companies/${country}` },
    {
      name: typeName,
      url: `/companies/${country}/${functionRoot}`,
    },
    {
      name: `Page ${pageNum}`,
      url: `/companies/${country}/${functionRoot}/${pageNum}`,
    },
  ];

  return (
    <>
      <BreadcrumbListSchema items={breadcrumbItems} baseUrl={baseUrl} />
      <Header
        showSearch={false}
        signInUrl={getSignInUrl()}
        signUpUrl={getSignUpUrl()}
      />
      <ContentContainer>
        <div
          style={{
            padding: '48px 32px',
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          <BreadcrumbNav items={breadcrumbItems} />
          <h1
            style={{
              fontFamily: 'var(--font-gabarito)',
              fontSize: 32,
              fontWeight: 700,
              marginTop: 24,
              marginBottom: 12,
            }}
          >
            {countryName} {typeName} Org Charts
          </h1>
          <p style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>
            Page {pageNum} · Browse {typeName} org charts in {countryName}
          </p>
          {companyIds.length === 0 ? (
            <p style={{ color: '#666' }}>No companies found.</p>
          ) : (
            <ul
              className="companies-grid"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {companyIds.map((companyId) => {
                const displayName = fromSlug(
                  decodeURIComponent(companyId).replace(/_/g, '-'),
                );
                return (
                  <li key={companyId}>
                    <Link
                      href={`/org-chart/${encodeURIComponent(companyId)}/${country}/${functionRoot}`}
                      style={{
                        fontSize: 15,
                        color: '#1a1a1a',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      {displayName}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <CompaniesPagination
            currentPage={pageNum}
            hasMore={hasMore}
            basePath={`/companies/${country}/${functionRoot}`}
          />
        </div>
      </ContentContainer>
    </>
  );
}
