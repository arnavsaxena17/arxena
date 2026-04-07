import { getAuthBaseUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { COMPANY_INFO } from '@/lib/company-info';

const SITE_NAVIGATION: {
  name: string;
  url: string;
  description?: string;
  isAbsolute?: boolean;
}[] = [
  {
    name: 'Pricing',
    url: '/pricing',
    description: 'Credits for mapping any company org chart',
  },
  {
    name: 'Story',
    url: '/story',
    description: 'Why we built Arxena',
  },
  {
    name: 'Engage',
    url: '/engage',
    description: 'AI outreach in your voice',
  },
  {
    name: 'App',
    url: '', // Resolved at runtime via getAuthBaseUrl()
    description: 'Sign in to Arxena',
    isAbsolute: true,
  },
];

export async function WebSiteStructuredData() {
  const baseUrl = await getBaseUrl();
  const appUrl = getAuthBaseUrl();

  const navItems = SITE_NAVIGATION.map((item) =>
    item.isAbsolute ? { ...item, url: appUrl } : item,
  );

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Arxena',
    url: baseUrl,
    description:
      'Map the org chart of any company you are targeting — sales, recruiting, investing, or research. 1M+ companies mapped, 800M+ professionals indexed. Real-time from LinkedIn and other sources.',
    publisher: {
      '@type': 'Organization',
      name: 'Arxena',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/images/favicon/icon-512.png`,
      },
      email: COMPANY_INFO.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: '651 N Broad St, Suite 206',
        addressLocality: 'Middletown',
        addressRegion: 'Delaware',
        postalCode: '19709',
        addressCountry: 'US',
      },
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/org-chart/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const navSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: navItems.map((item, i) => ({
      '@type': 'SiteNavigationElement',
      position: i + 1,
      name: item.name,
      url: item.isAbsolute ? item.url : `${baseUrl}${item.url}`,
      ...(item.description && { description: item.description }),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(navSchema),
        }}
      />
    </>
  );
}
