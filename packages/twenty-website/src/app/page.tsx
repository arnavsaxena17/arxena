import { ContentContainer } from './_components/ui/layout/ContentContainer';
import {
  LandingHero,
  LandingSocialProof,
  LandingHowItsDifferent,
  LandingEngagement,
  LandingLeadForm,
} from './_components/landing';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <ContentContainer>
      <LandingHero />
      <LandingSocialProof />
      <LandingHowItsDifferent />
      <LandingEngagement />
      <LandingLeadForm />
    </ContentContainer>
  );
}
