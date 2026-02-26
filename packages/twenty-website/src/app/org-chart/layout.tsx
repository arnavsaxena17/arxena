import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { OrgChartHeader } from '../_components/ui/layout/OrgChartHeader';

export default function OrgChartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <OrgChartHeader
        signInUrl={getSignInUrl()}
        signUpUrl={getSignUpUrl()}
      />
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
        {children}
      </div>
    </div>
  );
}
