import { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';

import {
  buildCanonicalOrgChartPath,
  extractOrgData,
  fromSlug,
  getProxiedImageUrl,
  processOrgChartToNodeData,
  resolveOrgChartCanonicalCompanyId,
  shouldRedirectOrgChartCompanySlug,
  toSlug,
  toTitleCase,
  OrgChartNodeData,
} from 'twenty-shared';

import { getSignUpUrl } from '@/lib/auth-urls';
import { getBaseUrl, getInternalAppUrl } from '@/lib/base-url';
import { getClientIpFromHeaders } from '@/lib/bot-detection';
import {
  extractOrgChartCompanyMetadataFromPayload,
  normalizeOptionalCompanyField,
} from '@/lib/org-chart-company-metadata';
import { readOrgChartStaticOnlyFromHeaders } from '@/lib/org-chart-static-only';
import { decodeOverEncodedPath } from '@/lib/url-utils';

import {
  BreadcrumbListSchema,
  BreadcrumbNav,
} from '@/app/_components/BreadcrumbList';
import { OrgChartPageClient } from './OrgChartPageClient';
import { OrgChartStructureSSR } from './OrgChartStructureSSR';
import { StaticOrgChartPage } from './StaticOrgChartPage';

export const dynamic = 'force-dynamic';

function buildForwardedOrgChartHeaders(
  requestHeaders: Headers,
  forwardedUserAgent?: string,
): Record<string, string> {
  const forwardedHeaders: Record<string, string> = {};
  const passthroughHeaderNames = [
    'cloudfront-viewer-address',
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded-for',
    'x-real-ip',
    'referer',
    'sec-fetch-site',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ] as const;

  for (const headerName of passthroughHeaderNames) {
    const value = requestHeaders.get(headerName);
    if (value) {
      forwardedHeaders[headerName] = value;
    }
  }

  const clientIp = getClientIpFromHeaders(requestHeaders);
  if (clientIp) {
    forwardedHeaders['x-org-chart-client-ip'] = clientIp;
  }

  if (forwardedUserAgent) {
    forwardedHeaders['x-forwarded-user-agent'] = forwardedUserAgent;
  }

  return forwardedHeaders;
}

type PageProps = {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function fetchSharedOrgChart(input: {
  shareToken: string;
  accessKey: string;
  forwardedUserAgent?: string;
}): Promise<Record<string, unknown> | null> {
  const baseUrl = await getInternalAppUrl();
  const requestHeaders = await headers();
  const forwardedHeaders = buildForwardedOrgChartHeaders(
    requestHeaders,
    input.forwardedUserAgent,
  );

  const params = new URLSearchParams();
  params.set('k', input.accessKey);
  const url = `${baseUrl}/api/org-chart/share/${encodeURIComponent(
    input.shareToken,
  )}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers:
        Object.keys(forwardedHeaders).length > 0 ? forwardedHeaders : undefined,
    });
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

async function fetchOrgChart(
  companyId: string,
  options: {
    companyName?: string;
    website?: string;
    country?: string;
    functionRoot?: string;
    forwardedUserAgent?: string;
  },
): Promise<Record<string, unknown> | null> {
  const baseUrl = await getInternalAppUrl();
  const params = new URLSearchParams();
  if (options.companyName) params.set('companyName', options.companyName);
  if (options.website) params.set('website', options.website);
  if (options.country) params.set('country', options.country);
  if (options.functionRoot) params.set('functionRoot', options.functionRoot);

  const queryString = params.toString();
  const path =
    companyId.toLowerCase() === 'yuga_labs' ? `manual/${companyId}` : companyId;
  const url = `${baseUrl}/api/org-chart/${path}${queryString ? `?${queryString}` : ''}`;
  const requestHeaders = await headers();
  const forwardedHeaders = buildForwardedOrgChartHeaders(
    requestHeaders,
    options.forwardedUserAgent,
  );

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers:
        Object.keys(forwardedHeaders).length > 0 ? forwardedHeaders : undefined,
    });
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

function formatCompanyNameForDisplay(companyId: string): string {
  const decoded = decodeURIComponent(companyId).replace(/_/g, '-');
  return fromSlug(decoded);
}

function buildSearchParamsString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      params.set(key, value);
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function maybePermanentRedirectToCanonicalOrgChartRoute(input: {
  rawCompanySlug: string;
  tailSegments: string[];
  searchParams: Record<string, string | string[] | undefined>;
}): void {
  if (!shouldRedirectOrgChartCompanySlug(input.rawCompanySlug)) {
    return;
  }

  const path = buildCanonicalOrgChartPath({
    companyId: input.rawCompanySlug,
    tailSegments: input.tailSegments,
  });
  permanentRedirect(`${path}${buildSearchParamsString(input.searchParams)}`);
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { segments } = await params;
  if (segments?.[0] === 'share') {
    return {
      title: 'Shared Org Chart - Arxena',
      description: 'A shared org chart link from Arxena.',
      alternates: { canonical: '/org-chart' },
    };
  }
  const rawCompanyId = segments?.[0]
    ? decodeOverEncodedPath(segments[0])
    : 'company';
  const companyId = resolveOrgChartCanonicalCompanyId(rawCompanyId);
  const companyName =
    typeof companyId === 'string'
      ? formatCompanyNameForDisplay(companyId)
      : 'Company';
  const country =
    segments?.[1] && segments[1] !== 'global'
      ? toTitleCase(fromSlug(segments[1]))
      : undefined;
  const functionRoot =
    segments?.[2] && segments[2] !== 'fullcompany'
      ? toTitleCase(fromSlug(segments[2]))
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
    keywords.push(
      `${companyName} ${country}`,
      `${companyName} ${country} office`,
    );
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

  const baseUrl = await getBaseUrl();
  const canonicalPath =
    segments && segments.length > 0
      ? `/org-chart/${encodeURIComponent(companyId)}${segments.length > 1 ? `/${segments.slice(1).join('/')}` : ''}`
      : `/org-chart/${encodeURIComponent(companyId)}`;
  // metadataBase in root layout resolves relative canonicals to https://arxena.com
  return {
    title,
    description,
    keywords: keywords.join(', '),
    openGraph: {
      title,
      description: ogDescription,
      type: 'website',
      url: canonicalPath,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ogDescription,
    },
    alternates: {
      canonical: canonicalPath,
    },
  };
}

export default async function OrgChartPage({
  params,
  searchParams,
}: PageProps) {
  const { segments } = await params;
  const resolvedSearchParams = await searchParams;

  const headersList = await headers();
  const forwardedUserAgent = headersList.get('user-agent') ?? undefined;
  const staticOnly = readOrgChartStaticOnlyFromHeaders(headersList);

  if (segments?.[0] && segments[0] !== 'share') {
    const rawCompanySlug = decodeOverEncodedPath(segments[0]);
    maybePermanentRedirectToCanonicalOrgChartRoute({
      rawCompanySlug,
      tailSegments: segments.slice(1),
      searchParams: resolvedSearchParams,
    });
  }

  if (segments?.[0] === 'share') {
    const shareToken = segments?.[1] ? decodeOverEncodedPath(segments[1]) : '';
    const accessKey =
      typeof resolvedSearchParams.k === 'string' ? resolvedSearchParams.k : '';

    if (!shareToken || !accessKey) {
      return (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <h1>Link expired</h1>
          <p>
            Get access to 10M Real Time Org Charts, Sign up to view any org
            chart you want.
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
    }

    const rawData = await fetchSharedOrgChart({
      shareToken,
      accessKey,
      forwardedUserAgent,
    });

    if (!rawData) {
      return (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <h1>Link expired</h1>
          <p>
            Get access to 10M Real Time Org Charts, Sign up to view any org
            chart you want.
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
          (out as Record<string, string>)[key] = getProxiedImageUrl(
            val,
            apiBase,
          );
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
        : companyId,
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

  const rawCompanyId = segments?.[0] ?? null;
  const companyId = rawCompanyId
    ? resolveOrgChartCanonicalCompanyId(decodeOverEncodedPath(rawCompanyId))
    : null;
  const country = segments?.[1]
    ? decodeOverEncodedPath(segments[1])
    : undefined;
  const functionRoot = segments?.[2]
    ? decodeOverEncodedPath(segments[2])
    : undefined;

  const normalizedCountry =
    country && country !== 'global'
      ? toTitleCase(fromSlug(country))
      : undefined;
  const normalizedFunctionRoot =
    functionRoot && functionRoot !== 'fullcompany'
      ? toTitleCase(fromSlug(functionRoot))
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
  const websiteFromQuery =
    typeof resolvedSearchParams.website === 'string'
      ? resolvedSearchParams.website
      : undefined;

  const rawData = await fetchOrgChart(companyId, {
    companyName,
    website: websiteFromQuery,
    country: normalizedCountry?.toLowerCase(),
    functionRoot: normalizedFunctionRoot?.toLowerCase(),
    forwardedUserAgent,
  });

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

  const {
    profileCount,
    locationName: locationNameRaw,
    industry: industryRaw,
    website: websiteFromPayload,
    linkedinUrl,
  } = extractOrgChartCompanyMetadataFromPayload(rawData);
  const displayCompanyName = toTitleCase(
    companyName ??
      (typeof rawData?.job_company_name === 'string'
        ? rawData.job_company_name
        : undefined) ??
      (typeof companyId === 'string' ? companyId : 'Company'),
  );
  const locationName = locationNameRaw
    ? toTitleCase(locationNameRaw)
    : undefined;
  const industry = industryRaw ? toTitleCase(industryRaw) : undefined;
  const website =
    normalizeOptionalCompanyField(websiteFromQuery) ?? websiteFromPayload;

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    {
      name: `${displayCompanyName} Org Chart`,
      url: `/org-chart/${encodeURIComponent(companyId)}`,
    },
  ];
  if (normalizedCountry) {
    breadcrumbItems.push({
      name: normalizedCountry,
      url: `/org-chart/${encodeURIComponent(companyId)}/${toSlug(normalizedCountry)}`,
    });
  }
  if (normalizedFunctionRoot) {
    const fnPath = normalizedCountry
      ? `/${toSlug(normalizedFunctionRoot)}`
      : `/global/${toSlug(normalizedFunctionRoot)}`;
    breadcrumbItems.push({
      name: normalizedFunctionRoot,
      url: `/org-chart/${encodeURIComponent(companyId)}${normalizedCountry ? `/${toSlug(normalizedCountry)}` : ''}${fnPath}`,
    });
  }

  const pageShellStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
    width: '100%',
  };

  if (staticOnly) {
    return (
      <div style={pageShellStyle}>
        <BreadcrumbListSchema items={breadcrumbItems} baseUrl={baseUrl} />
        <StaticOrgChartPage
          companyId={companyId}
          companyName={displayCompanyName}
          website={website}
          locationName={locationName}
          industry={industry}
          profileCount={profileCount}
          linkedinUrl={linkedinUrl}
          nodeDataArray={nodeDataArray}
          signUpUrl={getSignUpUrl()}
          breadcrumb={<BreadcrumbNav items={breadcrumbItems} />}
        />
      </div>
    );
  }

  return (
    <div style={pageShellStyle}>
      <BreadcrumbListSchema items={breadcrumbItems} baseUrl={baseUrl} />
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
        breadcrumb={<BreadcrumbNav items={breadcrumbItems} />}
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
