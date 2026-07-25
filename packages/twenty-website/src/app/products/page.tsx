import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { PRODUCTS_INDEX } from '@/lib/brand-content';
import { PRODUCT_PAGES } from '@/lib/marketing-site-pages';

import { MarketingIndexContent } from '@/app/_components/marketing/MarketingIndexContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Products | Arxena',
  description: PRODUCTS_INDEX.sub,
  alternates: {
    canonical: '/products',
  },
};

export default function ProductsIndexPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <MarketingIndexContent
          title={PRODUCTS_INDEX.title}
          sub={PRODUCTS_INDEX.sub}
          items={PRODUCT_PAGES}
          basePath="/products"
        />
      </ContentContainer>
    </>
  );
}
