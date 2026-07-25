import { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';

import {
  fromSlug,
  toTitleCase,
} from 'twenty-shared/utils';

import { OrgChartDiagramLoader } from '@/app/org-chart/[[...segments]]/OrgChartDiagramLoader';
import { OrgChartPageClient } from '@/app/org-chart/[[...segments]]/OrgChartPageClient';
import { OrgChartStructureSSR } from '@/app/org-chart/[[...segments]]/OrgChartStructureSSR';
import { getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { fetchPublishedOrgChart } from '@/lib/fetch-published-org-chart';
import { extractOrgChartCompanyMetadataFromPayload } from '@/lib/org-chart-company-metadata';
import { processPublishedOrgChartPayload } from '@/lib/process-published-org-chart-payload';
import { decodeOverEncodedPath } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ asOf?: string }>;
};

const monthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const normalizeAsOfMonthParam = (
  raw: string | undefined,
): string | undefined => {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || !monthKeyRegex.test(trimmed)) {
    return undefined;
  }
  return trimmed;
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
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
      canonical: publishSlug
        ? `/org/${encodeURIComponent(publishSlug)}`
        : '/org',
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublishedOrgChartPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const publishSlug = slug ? decodeOverEncodedPath(slug).trim() : '';
  const initialAsOfMonth = normalizeAsOfMonthParam(resolvedSearchParams.asOf);

  if (!publishSlug) {
    return <OrgChartUnavailable />;
  }

  const headersList = await headers();
  const forwardedUserAgent = headersList.get('user-agent') ?? undefined;

  const rawData = await fetchPublishedOrgChart({
    publishSlug,
    forwardedUserAgent,
    asOfMonth: initialAsOfMonth,
  });

  if (!rawData) {
    return <OrgChartUnavailable />;
  }

  const baseUrl = await getBaseUrl();
  const apiBase = `${baseUrl}/api/org-chart`;
  const { orgData, nodeDataArray } = processPublishedOrgChartPayload(
    rawData,
    apiBase,
  );

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

  const {
    profileCount,
    locationName: locationNameRaw,
    industry: industryRaw,
    website,
    linkedinUrl,
  } = extractOrgChartCompanyMetadataFromPayload(rawData);
  const locationName = locationNameRaw
    ? toTitleCase(locationNameRaw)
    : undefined;
  const industry = industryRaw ? toTitleCase(industryRaw) : undefined;

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
      <Suspense
        fallback={
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
            }}
          >
            Loading org chart…
          </div>
        }
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
          filterInPlace
          publishSlug={publishSlug}
          initialAsOfMonth={initialAsOfMonth}
          diagramLoader={<OrgChartDiagramLoader />}
        >
          <OrgChartStructureSSR
            nodeDataArray={nodeDataArray}
            companyName={displayCompanyName}
            locationName={locationName}
            industry={industry}
          />
        </OrgChartPageClient>
      </Suspense>
    </div>
  );
}
