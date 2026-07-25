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

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

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

async function fetchCompaniesByLetter(
  letter: string,
  page: number,
  maxExposedCount?: number,
): Promise<{ companyIds: string[]; hasMore: boolean }> {
  const baseUrl = await getBaseUrl();
  const url = new URL(`${baseUrl}/api/org-chart/companies/list`);
  url.searchParams.set('letter', letter);
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segment: string }>;
}): Promise<Metadata> {
  const { segment } = await params;
  const letterParsed = parseLetterSegment(segment);
  if (letterParsed) {
    const { letter, page } = letterParsed;
    const letterUpper = letter.toUpperCase();
    return {
      title: `Companies starting with ${letterUpper} - Page ${page} | Arxena`,
      description: `Browse organizational charts of companies starting with ${letterUpper}. Page ${page}. 1M+ companies on Arxena.`,
      alternates: { canonical: `/companies/${letter}-${page}` },
    };
  }
  const countryName = fromSlug(segment.replace(/_/g, '-'));
  return {
    title: `${countryName} Org Charts - Page 1 | Arxena`,
    description: `Browse organizational charts of companies in ${countryName}.`,
    alternates: { canonical: `/companies/${segment}` },
  };
}

export default async function CompaniesSegmentPage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;
  const letterParsed = parseLetterSegment(segment);
  const maxExposedCount = getMaxExposedUrlCount(getExposedBatchCount());

  const baseUrl = await getBaseUrl();

  if (letterParsed) {
    const { letter, page } = letterParsed;
    const { companyIds, hasMore } = await fetchCompaniesByLetter(
      letter,
      page,
      maxExposedCount || undefined,
    );
    return (
      <CompaniesLetterView
        letter={letter}
        page={page}
        companyIds={companyIds}
        hasMore={hasMore}
        baseUrl={baseUrl}
      />
    );
  }

  if (!isPhase2Exposed()) notFound();

  const { companyIds, hasMore } = await fetchCompaniesByCountry(
    segment,
    1,
    maxExposedCount || undefined,
  );
  return (
    <CompaniesCountryView
      country={segment}
      page={1}
      companyIds={companyIds}
      hasMore={hasMore}
      baseUrl={baseUrl}
    />
  );
}

function CompaniesLetterView({
  letter,
  page,
  companyIds,
  hasMore,
  baseUrl,
}: {
  letter: string;
  page: number;
  companyIds: string[];
  hasMore: boolean;
  baseUrl: string;
}) {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  const letterUpper = letter.toUpperCase();

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Companies', url: '/companies' },
    {
      name: `${letterUpper} - Page ${page}`,
      url: `/companies/${letter}-${page}`,
    },
  ];

  return (
    <>
      <BreadcrumbListSchema items={breadcrumbItems} baseUrl={baseUrl} />
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
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
            Companies starting with {letterUpper}
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 32,
            }}
          >
            Page {page} · Browse companies with org charts
          </p>

          {/* Letter index */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 40,
            }}
          >
            {LETTERS.map((l) => (
              <Link
                key={l}
                href={`/companies/${l}-${l === letter ? page : 1}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  fontSize: 14,
                  fontWeight: l === letter ? 700 : 500,
                  fontFamily: 'var(--font-gabarito)',
                  color: l === letter ? '#fff' : '#1a1a1a',
                  backgroundColor: l === letter ? '#1a1a1a' : '#f5f5f5',
                  borderRadius: 6,
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                }}
              >
                {l}
              </Link>
            ))}
          </div>

          {/* Company list */}
          {companyIds.length === 0 ? (
            <p style={{ color: '#666' }}>
              No companies found for this letter and page.
            </p>
          ) : (
            <ul
              className="companies-grid"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                marginTop: 8,
              }}
            >
              {companyIds.map((companyId) => {
                const displayName = fromSlug(
                  decodeURIComponent(companyId).replace(/_/g, '-'),
                );
                return (
                  <li key={companyId}>
                    <Link
                      href={`/org-chart/${encodeURIComponent(companyId)}`}
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
            currentPage={page}
            hasMore={hasMore}
            basePath={`/companies/${letter}`}
            letterMode
          />
        </div>
      </ContentContainer>
    </>
  );
}

function CompaniesCountryView({
  country,
  page,
  companyIds,
  hasMore,
  baseUrl,
}: {
  country: string;
  page: number;
  companyIds: string[];
  hasMore: boolean;
  baseUrl: string;
}) {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  const countryName = fromSlug(country.replace(/_/g, '-'));

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Companies', url: '/companies' },
    { name: countryName, url: `/companies/${country}` },
  ];

  return (
    <>
      <BreadcrumbListSchema items={breadcrumbItems} baseUrl={baseUrl} />
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
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
          <p
            style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 32,
            }}
          >
            Page {page} · Browse companies with org charts in {countryName}
          </p>

          {companyIds.length === 0 ? (
            <p style={{ color: '#666' }}>
              No companies found for this country.
            </p>
          ) : (
            <ul
              className="companies-grid"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                marginTop: 8,
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
            currentPage={1}
            hasMore={hasMore}
            basePath={`/companies/${country}`}
          />
        </div>
      </ContentContainer>
    </>
  );
}
