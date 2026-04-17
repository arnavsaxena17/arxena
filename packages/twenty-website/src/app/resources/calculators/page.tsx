import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ResourceSubpageContent } from '@/app/_components/marketing/ResourceSubpageContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'ROI calculators | Arxena',
  description:
    'Segment-specific ROI models for org intelligence — time saved, pipeline impact, and diligence efficiency.',
  alternates: {
    canonical: '/resources/calculators',
  },
};

export default function ResourcesCalculatorsPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ResourceSubpageContent
          headline="Calculators"
          paragraphs={[
            'Interactive ROI calculators tuned by buyer segment — executive search, sales, talent, strategy, and PE/VC — so you can quantify time saved, multi-threading lift, or diligence efficiency.',
            'We are rolling out calculators progressively. Book a conversation to walk through assumptions with your team or get early access.',
          ]}
          signUpUrl={signUpUrl}
          primaryCtaHref="/contact#schedule"
          primaryCtaLabel="Book a walkthrough"
        />
      </ContentContainer>
    </>
  );
}
