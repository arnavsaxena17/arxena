import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { isPhase2Exposed } from '@/lib/sitemap';

import {
  BreadcrumbListSchema,
  BreadcrumbNav,
} from '@/app/_components/BreadcrumbList';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Org Charts by Function | Arxena',
  description:
    'Browse organizational charts by function. Sales, Human Resources, Engineering, and more. Explore org structures by department.',
  alternates: { canonical: '/companies/by-function' },
};

async function fetchFunctions(): Promise<
  {
    type: string;
    typeSlug: string;
    topCountry: string;
    topCountrySlug: string;
    docCount: number;
  }[]
> {
  const baseUrl = await getBaseUrl();
  try {
    const res = await fetch(
      `${baseUrl}/api/org-chart/companies/countries-and-functions`,
      {
        cache: 'no-store',
      },
    );
    const data = (await res.json()) as {
      functions?: {
        type: string;
        typeSlug: string;
        topCountry: string;
        topCountrySlug: string;
        docCount: number;
      }[];
    };
    return data.functions ?? [];
  } catch {
    return [];
  }
}

export default async function CompaniesByFunctionPage() {
  if (!isPhase2Exposed()) notFound();
  const functions = await fetchFunctions();
  const baseUrl = await getBaseUrl();
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Companies', url: '/companies' },
    { name: 'By Function', url: '/companies/by-function' },
  ];

  return (
    <>
      <BreadcrumbListSchema items={breadcrumbItems} baseUrl={baseUrl} />
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <div
          style={{
            padding: '48px 32px',
            maxWidth: 900,
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
            Org Charts by Function
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 24,
              maxWidth: 560,
            }}
          >
            Browse organizational charts by function or department. Select a
            function to explore companies with that org structure.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 32,
            }}
          >
            <Link
              href="/companies"
              style={{
                fontSize: 14,
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Org charts by company →
            </Link>
            <Link
              href="/companies/by-country"
              style={{
                fontSize: 14,
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Org charts by geography →
            </Link>
          </div>
          {functions.length === 0 ? (
            <p style={{ color: '#666' }}>
              No functions available yet. Check back later.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {functions.map(({ type, typeSlug, topCountrySlug, docCount }) => (
                <li key={typeSlug}>
                  <Link
                    href={`/companies/${topCountrySlug}/${typeSlug}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: '#fafafa',
                      border: '1px solid #eee',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: '#1a1a1a',
                      fontWeight: 500,
                      fontSize: 16,
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{type}</span>
                    <span style={{ fontSize: 14, color: '#666' }}>
                      {docCount.toLocaleString()} org charts
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ContentContainer>
    </>
  );
}
