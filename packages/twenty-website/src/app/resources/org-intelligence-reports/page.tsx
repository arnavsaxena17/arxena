import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ResourceSubpageContent } from '@/app/_components/marketing/ResourceSubpageContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Org intelligence reports | Arxena',
  description:
    'Downloadable research and benchmarks on leadership, functions, and org structure — email-gated for teams who need primary data.',
  alternates: {
    canonical: '/resources/org-intelligence-reports',
  },
};

export default function OrgIntelligenceReportsPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ResourceSubpageContent
          headline="Org intelligence reports"
          paragraphs={[
            "Deep dives into how companies structure leadership and functions — built on Arxena's org intelligence dataset. Reports are released as PDFs and are typically gated behind email for qualified teams.",
            'Request access to upcoming releases or ask us about custom cuts for your sector or geography.',
          ]}
          signUpUrl={signUpUrl}
          primaryCtaHref="/contact#schedule"
          primaryCtaLabel="Request a report"
        />
      </ContentContainer>
    </>
  );
}
