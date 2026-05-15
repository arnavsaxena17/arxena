import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { BRAND, CONTACT_PAGE_SUB } from '@/lib/brand-content';

import { ContactContent } from '@/app/_components/contact/ContactContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: `Contact | ${BRAND.name}`,
  description: CONTACT_PAGE_SUB,
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <ContactContent />
      </ContentContainer>
    </>
  );
}
