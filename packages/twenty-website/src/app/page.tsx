import { Metadata } from 'next';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { HomepageHero } from './_components/homepage/HomepageHero';
import { ContentContainer } from './_components/ui/layout/ContentContainer';
import { Header } from './_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title:
    'Arxena — See inside any company | Org chart intelligence & AI outreach',
  description:
    'Arxena maps the org chart of any company in the world — not yours, theirs. Search, build lists, get contacts, and let AI reach out in your voice on WhatsApp, LinkedIn, and email. 1M+ companies mapped, 800M+ professionals indexed.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title:
      'Arxena — See inside any company | Org chart intelligence & AI outreach',
    description:
      "Map any target company's org chart in real time. Build lists, enrich contacts, and let AI engage for you — you only talk to warm replies.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'Arxena — See inside any company | Org chart intelligence & AI outreach',
    description:
      'Real-time org charts from LinkedIn and other sources. Search → map → list → contact → engage. 1M+ companies, 800M+ professionals.',
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
