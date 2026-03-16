import { Metadata } from 'next';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { HomepageHero } from './_components/homepage/HomepageHero';
import { ContentContainer } from './_components/ui/layout/ContentContainer';
import { Header } from './_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arxena — Org Chart AI | Real-Time Company Structures',
  description:
    'Org Chart AI: real-time company structures from LinkedIn. Map companies, build lists, fetch contacts, engage on WhatsApp and LinkedIn. Algorithmic recruitment. 1M+ companies, 55M+ professionals. Search any company org chart.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Arxena — Org Chart AI | Real-Time Company Structures',
    description:
      'Org Chart AI: real-time structures from LinkedIn. Map companies, build lists, fetch contacts, engage on WhatsApp and LinkedIn. 1M+ companies.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arxena — Org Chart AI | Real-Time Company Structures',
    description:
      'Org Chart AI: real-time company structures from LinkedIn. Map, build lists, fetch contacts, engage on WhatsApp and LinkedIn. 1M+ companies.',
  },
};

export default function Home() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <HomepageHero signInUrl={signInUrl} signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}
