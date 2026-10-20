import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { InternProgressionContent } from '@/app/_components/employment/InternProgressionContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Intern to Full-Time Progression Plan | Arxena',
  description:
    'How intern pay and status progress at Arxena, from trial to full-time employment.',
  alternates: {
    canonical: '/employment-docs/intern-progression',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function InternProgressionPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <InternProgressionContent />
      </ContentContainer>
    </>
  );
}
