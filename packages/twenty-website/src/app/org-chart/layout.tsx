import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { Header } from '../_components/ui/layout/header';


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
      <Header
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
