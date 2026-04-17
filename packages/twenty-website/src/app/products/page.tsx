import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { PRODUCT_PAGES } from '@/lib/marketing-site-pages';

import { MarketingIndexContent } from '@/app/_components/marketing/MarketingIndexContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata = {
  title: 'Products | Arxena',
  description:
    'The capabilities behind the pre-work: org explorer, function maps, timeline, connection intelligence, engagement layer, and API—for investors, search firms, and revenue teams.',
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
          title="Products"
          sub="Each product is a step in the pre-work—not a standalone chart feature. Map, plan, reach, and measure in one place."
          items={PRODUCT_PAGES}
          basePath="/products"
        />
      </ContentContainer>
    </>
  );
}
