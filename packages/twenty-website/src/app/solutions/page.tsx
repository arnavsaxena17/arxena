import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { SOLUTIONS_INDEX } from '@/lib/brand-content';
import { SOLUTION_PAGES } from '@/lib/marketing-site-pages';

import { MarketingIndexContent } from '@/app/_components/marketing/MarketingIndexContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Solutions | Arxena',
  description: SOLUTIONS_INDEX.sub,
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
          title={SOLUTIONS_INDEX.title}
          sub={SOLUTIONS_INDEX.sub}
          items={SOLUTION_PAGES}
          basePath="/solutions"
        />
      </ContentContainer>
    </>
  );
}
