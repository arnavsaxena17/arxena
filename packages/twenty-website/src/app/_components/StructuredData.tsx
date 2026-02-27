import { getAuthBaseUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';

const SITE_NAVIGATION: {
  name: string;
  url: string;
  description?: string;
  isAbsolute?: boolean;
}[] = [
  {
    name: 'Pricing',
    url: '/pricing',
    description: 'Simple pricing for org charts',
  },
  {
    name: 'Story',
    url: '/story',
    description: 'Our story and mission',
  },
  {
    name: 'Engage',
    url: '/engage',
    description: 'Reach the right people',
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
      'Search and explore organizational charts of any company. 1M+ companies, 55M+ professionals for recruitment and talent mapping.',
    publisher: {
      '@type': 'Organization',
      name: 'Arxena',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/images/favicon/512.png`,
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
