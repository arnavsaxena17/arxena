import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { TermsContent } from '@/app/_components/legal/TermsContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Terms of Service | Arxena',
  description:
    'Arxena Terms of Service - Legal agreement for using Arxena products and services.',
};

export default function TermsPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header
        showSearch={false}
        signInUrl={signInUrl}
        signUpUrl={signUpUrl}
      />
      <ContentContainer>
        <TermsContent />
      </ContentContainer>
    </>
  );
}
