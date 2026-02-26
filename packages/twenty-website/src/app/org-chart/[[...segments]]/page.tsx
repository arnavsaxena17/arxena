import { Metadata } from 'next';
import { headers } from 'next/headers';

import { extractOrgData, processOrgChartToNodeData } from 'twenty-shared';

import { getSignUpUrl } from '@/lib/auth-urls';

import { OrgChartPageClient } from './OrgChartPageClient';
import { OrgChartStructureSSR } from './OrgChartStructureSSR';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    const base = envUrl.startsWith('http') ? envUrl : `https://${envUrl}`;
    return base.replace(/\/$/, '');
  }
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3002';
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}

async function fetchOrgChart(
  companyId: string,
  options: {
    companyName?: string;
    website?: string;
    country?: string;
    functionRoot?: string;
  },
): Promise<Record<string, unknown> | null> {
  const baseUrl = await getBaseUrl();
  const params = new URLSearchParams();
  if (options.companyName) params.set('companyName', options.companyName);
  if (options.website) params.set('website', options.website);
  if (options.country) params.set('country', options.country);
  if (options.functionRoot) params.set('functionRoot', options.functionRoot);

  const queryString = params.toString();
  const path =
    companyId.toLowerCase() === 'yuga_labs' ? `manual/${companyId}` : companyId;
  const url = `${baseUrl}/api/org-chart/${path}${queryString ? `?${queryString}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const json = (await res.json()) as {
      status?: string;
      result?: Record<string, unknown>;
    };
    if (json?.status === 'ok' && json.result) return json.result;
  } catch {
    // fetch failed
  }
  return null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const companyId = segments?.[0] ?? 'company';
  const companyName =
    typeof companyId === 'string' ? decodeURIComponent(companyId) : companyId;

  return {
    title: `${companyName} Org Chart - Arxena`,
    description: `Explore the organizational structure of ${companyName}. View leadership, teams, and hierarchy.`,
    openGraph: {
      title: `${companyName} Org Chart - Arxena`,
      description: `Explore the organizational structure of ${companyName}.`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${companyName} Org Chart - Arxena`,
      description: `Explore the organizational structure of ${companyName}.`,
    },
  };
}

export default async function OrgChartPage({
  params,
  searchParams,
}: PageProps) {
  const { segments } = await params;
  const resolvedSearchParams = await searchParams;

  const companyId = segments?.[0] ?? null;
  const country = segments?.[1];
  const functionRoot = segments?.[2];

  const normalizedCountry =
    country && country !== 'global' ? decodeURIComponent(country) : undefined;
  const normalizedFunctionRoot =
    functionRoot && functionRoot !== 'fullcompany'
      ? decodeURIComponent(functionRoot)
      : undefined;

  if (!companyId) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h1>Company not found</h1>
        <p>Please search for a company from the homepage.</p>
      </div>
    );
  }

  const companyName =
    typeof resolvedSearchParams.companyName === 'string'
      ? resolvedSearchParams.companyName
      : undefined;
  const website =
    typeof resolvedSearchParams.website === 'string'
      ? resolvedSearchParams.website
      : undefined;

  const rawData = await fetchOrgChart(companyId, {
    companyName,
    website,
    country: normalizedCountry,
    functionRoot: normalizedFunctionRoot,
  });

  const orgData = extractOrgData(rawData);
  const nodeDataArray = orgData ? processOrgChartToNodeData(orgData) : [];

  const profileCount =
    typeof rawData?.profile_count === 'number'
      ? rawData.profile_count
      : undefined;
  const displayCompanyName =
    companyName ?? (typeof companyId === 'string' ? companyId : 'Company');
  const locationName =
    typeof rawData?.location_name === 'string'
      ? rawData.location_name
      : undefined;
  const industry =
    typeof rawData?.industry === 'string' ? rawData.industry : undefined;
  const linkedinUrl =
    typeof rawData?.linkedin_url === 'string'
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
        initialCountry={normalizedCountry}
        initialFunctionRoot={normalizedFunctionRoot}
        signUpUrl={getSignUpUrl()}
      >
        <OrgChartStructureSSR
          nodeDataArray={nodeDataArray}
          companyName={displayCompanyName}
        />
      </OrgChartPageClient>
    </div>
  );
}
