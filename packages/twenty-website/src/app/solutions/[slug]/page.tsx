import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { getSolutionBySlug, SOLUTION_SLUGS } from '@/lib/marketing-site-pages';

import { MarketingDetailContent } from '@/app/_components/marketing/MarketingDetailContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = getSolutionBySlug(params.slug);
  if (!page) {
    return { title: 'Not found | Arxena' };
  }
  return {
    title: `${page.title} | Arxena`,
    description: page.metaDescription,
    alternates: {
      canonical: `/solutions/${page.slug}`,
    },
  };
}

export default function SolutionDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const page = getSolutionBySlug(params.slug);
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
          backHref="/solutions"
          backLabel="← All solutions"
          signUpUrl={signUpUrl}
        />
      </ContentContainer>
    </>
  );
}
