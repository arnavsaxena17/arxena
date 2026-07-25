import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fromSlug } from 'twenty-shared/utils';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import {
  getExposedBatchCount,
  getMaxExposedUrlCount,
  isPhase2Exposed,
} from '@/lib/sitemap';

import {
  BreadcrumbListSchema,
  BreadcrumbNav,
} from '@/app/_components/BreadcrumbList';
import { CompaniesPagination } from '@/app/_components/CompaniesPagination';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

function parseLetterSegment(
  segment: string,
): { letter: string; page: number } | null {
  const match = segment.match(/^([a-z])-(\d+)$/);
  if (!match) return null;
  const [, letter, pageStr] = match;
  const page = parseInt(pageStr ?? '1', 10);
  if (!letter || page < 1) return null;
  return { letter, page };
}

async function fetchCompaniesByCountry(
  country: string,
  page: number,
  maxExposedCount?: number,
): Promise<{ companyIds: string[]; hasMore: boolean }> {
  const baseUrl = await getBaseUrl();
  const url = new URL(`${baseUrl}/api/org-chart/companies/list-by-country`);
  url.searchParams.set('country', country);
  url.searchParams.set('page', String(page));
  if (maxExposedCount)
    url.searchParams.set('maxExposedCount', String(maxExposedCount));
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = (await res.json()) as {
      companyIds?: string[];
      hasMore?: boolean;
    };
    return {
      companyIds: data.companyIds ?? [],
      hasMore: data.hasMore ?? false,
    };
  } catch {
    return { companyIds: [], hasMore: false };
  }
}

export async function fetchCompaniesByCountryAndType(
  country: string,
  type: string,
  page: number,
  maxExposedCount?: number,
): Promise<{ companyIds: string[]; hasMore: boolean }> {
  const baseUrl = await getBaseUrl();
  const url = new URL(
    `${baseUrl}/api/org-chart/companies/list-by-country-function`,
  );
  url.searchParams.set('country', country);
  url.searchParams.set('type', type);
  url.searchParams.set('page', String(page));
  if (maxExposedCount)
    url.searchParams.set('maxExposedCount', String(maxExposedCount));
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = (await res.json()) as {
      companyIds?: string[];
      hasMore?: boolean;
    };
    return {
      companyIds: data.companyIds ?? [],
      hasMore: data.hasMore ?? false,
    };
  } catch {
    return { companyIds: [], hasMore: false };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string; segment2: string }>;
}): Promise<Metadata> {
  const { segment, segment2 } = await params;
  if (parseLetterSegment(segment)) {
    return { title: 'Companies | Arxena' };
  }
  const pageNum = parseInt(segment2, 10);
  const isPage = !Number.isNaN(pageNum) && pageNum >= 1;
  const countryName = fromSlug(segment.replace(/_/g, '-'));
  if (isPage) {
    return {
      title: `${countryName} Org Charts - Page ${pageNum} | Arxena`,
      description: `Browse organizational charts of companies in ${countryName}. Page ${pageNum}.`,
      alternates: { canonical: `/companies/${segment}/${pageNum}` },
    };
  }
  const typeName = fromSlug(segment2.replace(/_/g, '-'));
  return {
    title: `${countryName} ${typeName} Org Charts | Arxena`,
    description: `Browse ${typeName} organizational charts of companies in ${countryName}.`,
    alternates: { canonical: `/companies/${segment}/${segment2}` },
  };
}

export default async function CompaniesSegment2Page({
  params,
}: {
  params: Promise<{ segment: string; segment2: string }>;
}) {
  const { segment, segment2 } = await params;

  if (!isPhase2Exposed()) notFound();

  if (parseLetterSegment(segment)) {
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
            <h1>Invalid URL</h1>
            <p>Use /companies/a-1 for letter browse.</p>
            <Link href="/companies">Browse Companies</Link>
          </div>
        </ContentContainer>
      </>
    );
  }

  const country = segment;
  const pageNum = parseInt(segment2, 10);
  const isPage = !Number.isNaN(pageNum) && pageNum >= 1;
  const maxExposedCount = getMaxExposedUrlCount(getExposedBatchCount());

  const baseUrl = await getBaseUrl();

  if (isPage) {
    const { companyIds, hasMore } = await fetchCompaniesByCountry(
      country,
      pageNum,
      maxExposedCount || undefined,
    );
    const countryName = fromSlug(country.replace(/_/g, '-'));
    const breadcrumbItems = [
      { name: 'Home', url: '/' },
      { name: 'Companies', url: '/companies' },
      { name: countryName, url: `/companies/${country}` },
      { name: `Page ${pageNum}`, url: `/companies/${country}/${pageNum}` },
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
              {countryName} Org Charts
            </h1>
            <p style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>
              Page {pageNum} · Browse companies with org charts in {countryName}
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
                        href={`/org-chart/${encodeURIComponent(companyId)}/${country}/fullcompany`}
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
              basePath={`/companies/${country}`}
            />
          </div>
        </ContentContainer>
      </>
    );
  }

  const functionRoot = segment2;
  const { companyIds, hasMore } = await fetchCompaniesByCountryAndType(
    country,
    functionRoot,
    1,
    maxExposedCount || undefined,
  );
  const countryName = fromSlug(country.replace(/_/g, '-'));
  const typeName = fromSlug(functionRoot.replace(/_/g, '-'));
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Companies', url: '/companies' },
    { name: countryName, url: `/companies/${country}` },
    { name: typeName, url: `/companies/${country}/${functionRoot}` },
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
            Browse {typeName} org charts of companies in {countryName}
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
            currentPage={1}
            hasMore={hasMore}
            basePath={`/companies/${country}/${functionRoot}`}
          />
        </div>
      </ContentContainer>
    </>
  );
}
