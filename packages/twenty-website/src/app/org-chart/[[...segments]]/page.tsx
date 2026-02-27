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

function formatCompanyName(companyId: string): string {
  return decodeURIComponent(companyId)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segments } = await params;
  const companyId = segments?.[0] ?? 'company';
  const companyName =
    typeof companyId === 'string' ? formatCompanyName(companyId) : 'Company';
  const country =
    segments?.[1] && segments[1] !== 'global'
      ? decodeURIComponent(segments[1])
      : undefined;
  const functionRoot =
    segments?.[2] && segments[2] !== 'fullcompany'
      ? decodeURIComponent(segments[2])
      : undefined;

  const titleParts: string[] = [];
  if (functionRoot) {
    titleParts.push(`${functionRoot} Team at ${companyName}`);
  } else {
    titleParts.push(`${companyName}`);
  }
  if (country) {
    titleParts.push(`(${country})`);
  }
  const baseTitle = titleParts.join(' ') + ' Org Chart';
  const title = `${baseTitle} - Arxena`;

  const descParts: string[] = [];
  if (functionRoot) {
    descParts.push(
      `${companyName}'s ${functionRoot} team org structure: management, leadership, and organisation structure.`,
    );
  } else {
    descParts.push(
      `${companyName}'s org structure and organization structure: executive team, leadership, management hierarchy, and departments.`,
    );
  }
  if (country) {
    descParts.push(`${companyName} ${country} office.`);
  }
  descParts.push(
    `Find decision-makers for recruitment, sales outreach, talent mapping. 1M+ companies on Arxena.`,
  );
  const description = descParts.join(' ');

  const keywords: string[] = [
    `${companyName} org chart`,
    `${companyName} org structure`,
    `${companyName} organizational chart`,
    `${companyName} organization structure`,
    `${companyName} organisation structure`,
    `orgchart ${companyName}`,
    `team at ${companyName}`,
    `${companyName} team`,
    `${companyName} team structure`,
    `${companyName} leadership`,
    `${companyName} leadership team`,
    `${companyName} management`,
    `${companyName} executive team`,
    `${companyName} hierarchy`,
  ];
  if (functionRoot) {
    keywords.push(
      `${functionRoot} team at ${companyName}`,
      `${companyName} ${functionRoot} team`,
    );
  }
  if (country) {
    keywords.push(`${companyName} ${country}`, `${companyName} ${country} office`);
  }
  keywords.push(
    'recruitment',
    'talent mapping',
    'people analytics',
    'leadership',
    'management',
    'executive team',
    'org structure',
    'organization structure',
    'organisation structure',
  );

  const ogDescription =
    descParts.length > 1
      ? descParts.slice(0, 2).join(' ')
      : `${companyName} org structure and organization structure: executive team, leadership. 1M+ companies on Arxena.`;

  return {
    title,
    description,
    keywords: keywords.join(', '),
    openGraph: {
      title,
      description: ogDescription,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
    },
    alternates: {
      canonical: `/org-chart/${[companyId, country, functionRoot]
        .filter(Boolean)
        .map((s) => encodeURIComponent(s as string))
        .join('/')}`,
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
          locationName={locationName}
          industry={industry}
          country={normalizedCountry}
          functionRoot={normalizedFunctionRoot}
        />
      </OrgChartPageClient>
    </div>
  );
}
