import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ContactContent } from '@/app/_components/contact/ContactContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Contact | Arxena',
  description:
    'Contact Arxena — email, WhatsApp, live chat, office locations, and schedule a call.',
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
