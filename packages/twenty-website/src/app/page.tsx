import { Metadata } from 'next';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { HomepageHero } from './_components/homepage/HomepageHero';
import { ContentContainer } from './_components/ui/layout/ContentContainer';
import { Header } from './_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arxena - Search Any Company\'s Org Chart',
  description:
    'Arxena lets you search and explore organizational charts of any company. Access 1M+ companies and 55M+ professionals for recruitment, outreach, and people analytics. Free org chart search.',
  openGraph: {
    title: 'Arxena - Search Any Company\'s Org Chart',
    description:
      'Search organizational charts of any company. 1M+ companies, 55M+ professionals. Built for recruiters, sales teams, and talent mapping.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Arxena - Search Any Company\'s Org Chart',
    description:
      'Search organizational charts of any company. 1M+ companies, 55M+ professionals for recruitment and people analytics.',
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
