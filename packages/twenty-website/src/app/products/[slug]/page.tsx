import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { getProductBySlug, PRODUCT_SLUGS } from '@/lib/marketing-site-pages';

import { MarketingDetailContent } from '@/app/_components/marketing/MarketingDetailContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export function generateStaticParams() {
  return PRODUCT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = getProductBySlug(params.slug);
  if (!page) {
    return { title: 'Not found | Arxena' };
  }
  return {
    title: `${page.title} | Arxena`,
    description: page.metaDescription,
    alternates: {
      canonical: `/products/${page.slug}`,
    },
  };
}

export default function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const page = getProductBySlug(params.slug);
  if (!page) {
    notFound();
  }

  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <MarketingDetailContent
          page={page}
          backHref="/products"
          backLabel="← All products"
          signUpUrl={signUpUrl}
        />
      </ContentContainer>
    </>
  );
}
