import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ChromeExtensionContent } from '@/app/_components/chrome-extension/ChromeExtensionContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Chrome extension | Arxena',
  description:
    'Install the Arxena Chrome extension for LinkedIn: connect your account, view profiles, reveal phone numbers, and message candidates for your open roles.',
  alternates: {
    canonical: '/chrome-extension',
  },
};

export default function ChromeExtensionPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ChromeExtensionContent />
      </ContentContainer>
    </>
  );
}
