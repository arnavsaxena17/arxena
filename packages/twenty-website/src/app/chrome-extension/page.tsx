import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, CHROME_EXTENSION_PAGE } from '@/lib/brand-content';

import { ChromeExtensionContent } from '@/app/_components/chrome-extension/ChromeExtensionContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Chrome extension | ${BRAND.name}`,
  description: CHROME_EXTENSION_PAGE.subheadline,
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
