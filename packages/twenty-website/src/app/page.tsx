import { Metadata } from 'next';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import {
  DEFAULT_OG_TITLE,
  DEFAULT_SITE_DESCRIPTION,
} from '@/lib/brand-content';

import { HomepageHero } from './_components/homepage/HomepageHero';
import { ContentContainer } from './_components/ui/layout/ContentContainer';
import { Header } from './_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: DEFAULT_OG_TITLE,
  description: DEFAULT_SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: DEFAULT_OG_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_OG_TITLE,
    description: DEFAULT_SITE_DESCRIPTION,
  },
};

export default function Home() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  return (
    <>
      <Header
        showSearch={false}
        showCurrencySelector={false}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
      />
      <ContentContainer>
        <HomepageHero signInUrl={signInUrl} signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}
