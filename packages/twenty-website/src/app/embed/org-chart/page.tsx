import { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';

import { toTitleCase } from 'twenty-shared/utils';

import { OrgChartDiagramLoader } from '@/app/org-chart/[[...segments]]/OrgChartDiagramLoader';
import { OrgChartPageClient } from '@/app/org-chart/[[...segments]]/OrgChartPageClient';
import { OrgChartStructureSSR } from '@/app/org-chart/[[...segments]]/OrgChartStructureSSR';
import { getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl } from '@/lib/base-url';
import { fetchEmbedOrgChart } from '@/lib/fetch-embed-org-chart';
import { extractOrgChartCompanyMetadataFromPayload } from '@/lib/org-chart-company-metadata';
import { processPublishedOrgChartPayload } from '@/lib/process-published-org-chart-payload';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Org Chart Embed | Arxena',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{
    key?: string;
    domain?: string;
  }>;
};

const EmbedUnavailable = ({ message }: { message: string }) => (
  <div style={{ padding: 48, textAlign: 'center' }}>
    <h1 style={{ fontSize: 20, marginBottom: 8 }}>Org chart unavailable</h1>
    <p style={{ color: '#666', margin: 0 }}>{message}</p>
  </div>
);

export default async function EmbedOrgChartPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const embedKey = resolvedSearchParams.key?.trim() ?? '';
  const domain = resolvedSearchParams.domain?.trim();

  if (!embedKey) {
    return (
      <EmbedUnavailable message="Missing embed key. Add ?key=emb_xxx to the URL." />
    );
  }

  const headersList = await headers();
  const forwardedUserAgent = headersList.get('user-agent') ?? undefined;

  const embedData = await fetchEmbedOrgChart({
    embedKey,
    domain,
    forwardedUserAgent,
  });

  if (!embedData) {
    return (
      <EmbedUnavailable message="This embed is not available. Check your embed key, allowed origins, and domain." />
    );
  }

  const rawData = embedData.result;
  const baseUrl = await getBaseUrl();
  const apiBase = `${baseUrl}/api/org-chart`;
  const { nodeDataArray } = processPublishedOrgChartPayload(rawData, apiBase);

  const companyId =
    typeof rawData?.company_id === 'string'
      ? rawData.company_id
      : embedData.companyId;

  const displayCompanyName = toTitleCase(
    embedData.companyName ||
      (typeof rawData?.job_company_name === 'string'
        ? rawData.job_company_name
        : 'Company'),
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

  const hidePoweredBy = embedData.options?.hidePoweredBy === true;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
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
          signUpUrl={getSignUpUrl()}
          filterInPlace={embedData.mode === 'published'}
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
      {!hidePoweredBy && (
        <footer
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            textAlign: 'center',
            fontSize: 12,
            color: '#818181',
            borderTop: '1px solid #eee',
          }}
        >
          <a
            href="https://arxena.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#474747', textDecoration: 'none' }}
          >
            Powered by Arxena
          </a>
        </footer>
      )}
    </div>
  );
}
