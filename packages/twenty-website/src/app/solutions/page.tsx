import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { SOLUTION_PAGES } from '@/lib/marketing-site-pages';

import { MarketingIndexContent } from '@/app/_components/marketing/MarketingIndexContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Solutions | Arxena',
  description:
    'Pre-call intelligence for investors, longlists before the brief for search, account planning before outreach for sales—each supported from map to conversation.',
  alternates: {
    canonical: '/solutions',
  },
};

export default function SolutionsIndexPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <MarketingIndexContent
          title="Solutions"
          sub="Pick your workflow. Pre-call intelligence for investors. Longlists before the brief for search. Account planning before outreach for sales."
          items={SOLUTION_PAGES}
          basePath="/solutions"
        />
      </ContentContainer>
    </>
  );
}
