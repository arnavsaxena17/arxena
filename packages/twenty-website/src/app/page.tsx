import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { HomepageHero } from './_components/homepage/HomepageHero';
import { ContentContainer } from './_components/ui/layout/ContentContainer';
import { OrgChartHeader } from './_components/ui/layout/OrgChartHeader';

export const dynamic = 'force-dynamic';

export default function Home() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  return (
    <>
      <OrgChartHeader
        showSearch={false}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
      />
      <ContentContainer>
        <HomepageHero signInUrl={signInUrl} signUpUrl={signUpUrl} />
      </ContentContainer>
    </>
  );
}
