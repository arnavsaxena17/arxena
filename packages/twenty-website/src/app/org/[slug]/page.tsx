import { Metadata } from 'next';
import { headers } from 'next/headers';

import {
    extractOrgData,
    fromSlug,
    getProxiedImageUrl,
    processOrgChartToNodeData,
    toTitleCase,
    type OrgChartNodeData,
} from 'twenty-shared';

import { OrgChartPageClient } from '@/app/org-chart/[[...segments]]/OrgChartPageClient';
import { OrgChartStructureSSR } from '@/app/org-chart/[[...segments]]/OrgChartStructureSSR';
import { getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { fetchPublishedOrgChart } from '@/lib/fetch-published-org-chart';
import { decodeOverEncodedPath } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
};

const OrgChartUnavailable = () => (
  <div style={{ padding: 48, textAlign: 'center' }}>
    <h1>Org chart unavailable</h1>
    <p>
      This published org chart is not available. It may have expired or was
      removed.
    </p>
    <a
      href={getSignUpUrl()}
      style={{
        display: 'inline-flex',
        padding: '12px 18px',
        borderRadius: 10,
        background: '#000',
        color: '#fff',
        textDecoration: 'none',
        fontWeight: 600,
        marginTop: 12,
      }}
    >
      Sign up
    </a>
  </div>
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const publishSlug = slug ? decodeOverEncodedPath(slug) : '';
  const displayName = publishSlug
    ? toTitleCase(fromSlug(publishSlug))
    : 'Company';

  const title = `${displayName} Org Chart - Arxena`;
  const description = `${displayName} organization structure and leadership team on Arxena.`;

  return {
    title,
    description,
    alternates: {
      canonical: publishSlug ? `/org/${encodeURIComponent(publishSlug)}` : '/org',
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublishedOrgChartPage({ params }: PageProps) {
  const { slug } = await params;
  const publishSlug = slug ? decodeOverEncodedPath(slug).trim() : '';

  if (!publishSlug) {
    return <OrgChartUnavailable />;
  }

  const headersList = await headers();
  const forwardedUserAgent = headersList.get('user-agent') ?? undefined;

  const rawData = await fetchPublishedOrgChart({
    publishSlug,
    forwardedUserAgent,
  });

  if (!rawData) {
    return <OrgChartUnavailable />;
  }

  const orgData = extractOrgData(rawData);
  const baseUrl = await getBaseUrl();
  const apiBase = `${baseUrl}/api/org-chart`;
  const rawNodeDataArray = orgData ? processOrgChartToNodeData(orgData) : [];
  const nodeDataArray = rawNodeDataArray.map((node) => {
    const out = { ...node } as OrgChartNodeData;
    for (let i = 0; i < 4; i++) {
      const key = `image_${i}` as keyof OrgChartNodeData;
      const val = out[key];
      if (typeof val === 'string' && val) {
        (out as Record<string, string>)[key] = getProxiedImageUrl(val, apiBase);
      }
    }
    return out;
  });

  const companyId =
    typeof rawData?.company_id === 'string'
      ? rawData.company_id
      : typeof rawData?.job_company_id === 'string'
        ? rawData.job_company_id
        : 'company';
  const displayCompanyName = toTitleCase(
    typeof rawData?.job_company_name === 'string'
      ? rawData.job_company_name
      : fromSlug(publishSlug),
  );

  const profileCount =
    typeof rawData?.profile_count === 'number' ? rawData.profile_count : undefined;
  const locationName =
    typeof rawData?.location_name === 'string'
      ? toTitleCase(rawData.location_name)
      : undefined;
  const industry =
    typeof rawData?.industry === 'string' ? toTitleCase(rawData.industry) : undefined;
  const website =
    typeof rawData?.job_company_website === 'string'
      ? rawData.job_company_website
      : typeof rawData?.website === 'string'
        ? rawData.website
        : undefined;
  const linkedinUrl =
    typeof rawData?.job_company_linkedin_url === 'string'
      ? rawData.job_company_linkedin_url
      : typeof rawData?.linkedin_url === 'string'
        ? rawData.linkedin_url
        : undefined;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
      }}
    >
      <OrgChartPageClient
        companyId={companyId}
        companyName={displayCompanyName}
        website={website}
        locationName={locationName}
        industry={industry}
        profileCount={profileCount}
        linkedinUrl={linkedinUrl}
        nodeDataArray={nodeDataArray}
        orgData={rawData}
        initialCountry={undefined}
        initialFunctionRoot={undefined}
        signUpUrl={getSignUpUrl()}
      >
        <OrgChartStructureSSR
          nodeDataArray={nodeDataArray}
          companyName={displayCompanyName}
          locationName={locationName}
          industry={industry}
        />
      </OrgChartPageClient>
    </div>
  );
}
