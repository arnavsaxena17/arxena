import Link from 'next/link';

import { OrgChartNodeData } from 'twenty-shared';

import { OrgChartStructureSSR } from './OrgChartStructureSSR';

type StaticOrgChartPageProps = {
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  nodeDataArray: OrgChartNodeData[];
  signUpUrl: string;
  breadcrumb?: React.ReactNode;
};

export function StaticOrgChartPage({
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  nodeDataArray,
  signUpUrl,
  breadcrumb,
}: StaticOrgChartPageProps) {
  const metaParts: string[] = [];
  if (locationName) {
    metaParts.push(locationName);
  }
  if (industry) {
    metaParts.push(industry);
  }
  if (typeof profileCount === 'number') {
    metaParts.push(`${profileCount.toLocaleString()} profiles`);
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
        padding: '0 24px 48px',
      }}
    >
      {breadcrumb}
      <header style={{ paddingTop: 16, paddingBottom: 8 }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>
          {companyName} Org Chart
        </h1>
        {metaParts.length > 0 ? (
          <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
            {metaParts.join(' · ')}
          </p>
        ) : null}
        {website ? (
          <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
            <a
              href={website.startsWith('http') ? website : `https://${website}`}
            >
              {website}
            </a>
          </p>
        ) : null}
        {linkedinUrl ? (
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            <a href={linkedinUrl}>LinkedIn</a>
          </p>
        ) : null}
      </header>
      <p style={{ margin: '0 0 16px', color: '#444', maxWidth: 720 }}>
        Interactive org chart visualization is available in the browser. Sign up
        to explore {companyName}&apos;s full leadership map, filters, and
        recruiting workflows.
      </p>
      <Link
        href={signUpUrl}
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          padding: '12px 18px',
          borderRadius: 10,
          background: '#000',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        Sign up to view interactive org chart
      </Link>
      <OrgChartStructureSSR
        nodeDataArray={nodeDataArray}
        companyName={companyName}
        locationName={locationName}
        industry={industry}
      />
      <p style={{ marginTop: 24, fontSize: '0.85rem', color: '#888' }}>
        Company ID: {companyId}
      </p>
    </div>
  );
}
