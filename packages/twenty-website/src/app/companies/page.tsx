import { Metadata } from 'next';
import Link from 'next/link';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export const metadata: Metadata = {
  title: 'Browse Companies by Letter | Arxena',
  description:
    'Browse organizational charts of companies alphabetically. Explore 1M+ companies from A to Z. Find org structures for recruitment, sales outreach, and talent mapping.',
  alternates: {
    canonical: '/companies',
  },
  openGraph: {
    title: 'Browse Companies by Letter | Arxena',
    description:
      'Browse organizational charts of companies alphabetically. 1M+ companies from A to Z.',
    type: 'website',
  },
};

export default function CompaniesIndexPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <div
          style={{
            padding: '48px 32px',
            maxWidth: 900,
            margin: '0 auto',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-gabarito)',
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Browse Companies
          </h1>
          <p
            style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 24,
              maxWidth: 560,
            }}
          >
            Explore organizational charts of companies alphabetically. Select a
            letter to browse companies starting with that letter.
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
            <Link
              href="/companies/by-function"
              style={{
                fontSize: 14,
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Org charts by function →
            </Link>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {LETTERS.map((letter) => (
              <Link
                key={letter}
                href={`/companies/${letter}-1`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: 'var(--font-gabarito)',
                  color: '#1a1a1a',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 8,
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  transition: 'background-color 0.2s, color 0.2s',
                }}
              >
                {letter}
              </Link>
            ))}
          </div>
        </div>
      </ContentContainer>
    </>
  );
}
