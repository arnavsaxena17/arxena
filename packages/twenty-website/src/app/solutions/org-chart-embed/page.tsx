import { Metadata } from 'next';

import { getAuthBaseUrl, getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { ORG_CHART_EMBED_SOLUTION_PAGE } from '@/lib/org-chart-embed-solution-content';

import { OrgChartEmbedSolutionContent } from '@/app/_components/solutions/OrgChartEmbedSolutionContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata: Metadata = {
  title: `${ORG_CHART_EMBED_SOLUTION_PAGE.title} | Arxena`,
  description: ORG_CHART_EMBED_SOLUTION_PAGE.metaDescription,
  alternates: {
    canonical: `/solutions/${ORG_CHART_EMBED_SOLUTION_PAGE.slug}`,
  },
};

export default function OrgChartEmbedSolutionPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  const developersSettingsUrl = `${getAuthBaseUrl()}/settings/developers`;

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <OrgChartEmbedSolutionContent
          developersSettingsUrl={developersSettingsUrl}
          signUpUrl={signUpUrl}
        />
      </ContentContainer>
    </>
  );
}
