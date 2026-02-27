import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { PrivacyContent } from '@/app/_components/legal/PrivacyContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Privacy Policy | Arxena',
  description:
    'Arxena Privacy Policy - How we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
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
        <PrivacyContent />
      </ContentContainer>
    </>
  );
}
