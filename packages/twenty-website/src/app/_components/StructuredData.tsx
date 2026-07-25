import { getAuthBaseUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { STRUCTURED_DATA } from '@/lib/brand-content';
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
    description: STRUCTURED_DATA.nav.pricing,
  },
  {
    name: 'Story',
    url: '/story',
    description: STRUCTURED_DATA.nav.story,
  },
  {
    name: 'Engage',
    url: '/engage',
    description: STRUCTURED_DATA.nav.engage,
  },
  {
    name: 'App',
    url: '', // Resolved at runtime via getAuthBaseUrl()
    description: STRUCTURED_DATA.nav.app,
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
    description: STRUCTURED_DATA.siteDescription,
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
