import { IconDatabase } from 'twenty-ui/icon';
import { lazy, Suspense, useEffect } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { AppPath } from 'twenty-shared/types';
import {
  buildCanonicalOrgChartPath,
  resolveOrgChartCanonicalCompanyId,
  shouldRedirectOrgChartCompanySlug,
} from 'twenty-shared/utils';

import { useHasAccessTokenPair } from '@/auth/hooks/useHasAccessTokenPair';
import { useBaileysConnection } from '@/baileys/contexts/BaileysContext';
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { useChromeExtensionDetection } from '@/candidate-table/hooks/useChromeExtensionDetection';
import { OrgChartWorkspaceReadyEmptyState } from '@/orgchart/components/OrgChartWorkspaceReadyEmptyState';
import { orgChartSelectionSearch } from '@/orgchart/utils/orgChartUtils';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';

const loadArxOrgChart = () =>
  import('@/orgchart/ArxOrgChart').then((module) => ({
    default: module.ArxOrgChart,
  }));

// Retry once after Vite HMR aborts a mid-reload dynamic import
const ArxOrgChart = lazy(() =>
  loadArxOrgChart().catch(() => loadArxOrgChart()),
);

type OrgChartRouteLocationState = {
  company?: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
    companyDomain?: string;
  };
};

type WorkspaceCreditsQuery = {
  workspaceCredits?: {
    orgChartCredits: number;
    revealCredits: number;
    revealCreditsAsEmailEquivalent?: number;
    revealCreditsAsPhoneEquivalent?: number;
    emailRevealCost?: number;
    phoneRevealCost?: number;
  };
};

export const OrgChartRoute = () => {
  const { companyKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hasToken = useHasAccessTokenPair();
  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;
  const { isExtensionInstalled } = useChromeExtensionDetection();
  const { data: creditsData } = useQuery<WorkspaceCreditsQuery>(WORKSPACE_CREDITS);
  const credits = creditsData?.workspaceCredits;
  const orgChartCredits = credits?.orgChartCredits;
  const revealCredits = credits?.revealCredits;
  const revealCreditsAsEmailEquivalent =
    credits?.revealCreditsAsEmailEquivalent;
  const revealCreditsAsPhoneEquivalent =
    credits?.revealCreditsAsPhoneEquivalent;
  const emailRevealCost = credits?.emailRevealCost;
  const phoneRevealCost = credits?.phoneRevealCost;

  const routeState = location.state as OrgChartRouteLocationState | null;
  const companyFromState = routeState?.company;

  const companyNameFromQuery =
    searchParams.get('companyName')?.trim() || undefined;
  const websiteFromQuery = searchParams.get('website')?.trim() || undefined;
  const companyDomainFromQuery =
    searchParams.get('companyDomain')?.trim() || undefined;

  const companyName = companyFromState?.companyName ?? companyNameFromQuery;
  const website = companyFromState?.website ?? websiteFromQuery;
  const companyDomain =
    companyFromState?.companyDomain ?? companyDomainFromQuery;

  const rawCompanyId = companyFromState?.companyId ?? companyKey ?? '';
  const companyId = rawCompanyId
    ? resolveOrgChartCanonicalCompanyId(rawCompanyId)
    : '';
  const hasSelectedCompany = Boolean(companyId.trim());

  useEffect(() => {
    if (!companyKey?.trim() || !companyId.trim()) {
      return;
    }
    const decodedKey = decodeURIComponent(companyKey).trim();
    if (!shouldRedirectOrgChartCompanySlug(decodedKey)) {
      return;
    }
    const canonicalPath = buildCanonicalOrgChartPath({
      companyId: decodedKey,
    }).replace(/^\/org-chart/u, `/${AppPath.OrgChart}`);
    navigate(
      {
        pathname: canonicalPath,
        search: location.search,
      },
      {
        replace: true,
        state: companyFromState
          ? {
              company: {
                ...companyFromState,
                companyId: resolveOrgChartCanonicalCompanyId(decodedKey),
              },
            }
          : routeState,
      },
    );
  }, [
    companyId,
    companyKey,
    companyFromState,
    location.search,
    routeState,
    navigate,
  ]);

  const handleBack = () => {
    navigate(`/${AppPath.Projects}`);
  };

  const handleCompanySelect = (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
    companyDomain?: string;
  }) => {
    navigate(
      {
        pathname: `/${AppPath.OrgChart}/${company.companyId}`,
        search: orgChartSelectionSearch(company),
      },
      { state: { company } },
    );
  };

  const handleAddJob = () => {
    navigate(`/${AppPath.Projects}`);
  };

  const handleDownloadClick = () => {
    window.open('https://chrome.google.com/webstore', '_blank', 'noopener');
  };

  return (
    <PageContainer>
      <CandidateTablePageHeader
        title="Org Charts"
        Icon={IconDatabase}
        onAddJob={handleAddJob}
        onOrgCharts={() => navigate(`/${AppPath.OrgChart}`)}
        onCompanySelect={hasSelectedCompany ? handleCompanySelect : undefined}
        hasToken={!!hasToken}
        isExtensionInstalled={isExtensionInstalled}
        onDownloadClick={handleDownloadClick}
        hasInsufficientCredits={false}
        isLinkedinConnected={isLinkedinConnected}
        isWhatsappLoggedIn={isWhatsappLoggedIn}
        orgChartCredits={orgChartCredits}
        revealCredits={revealCredits}
        revealCreditsAsEmailEquivalent={revealCreditsAsEmailEquivalent}
        revealCreditsAsPhoneEquivalent={revealCreditsAsPhoneEquivalent}
        emailRevealCost={emailRevealCost}
        phoneRevealCost={phoneRevealCost}
      />
      <PageBody>
        {hasSelectedCompany ? (
          <Suspense fallback={null}>
            <ArxOrgChart
              key={companyId}
              companyId={companyId}
              companyName={companyName}
              website={website}
              locationName={companyFromState?.locationName}
              industry={companyFromState?.industry}
              profileCount={companyFromState?.profileCount}
              linkedinUrl={companyFromState?.linkedinUrl}
              companyDomain={companyDomain}
              onBack={handleBack}
            />
          </Suspense>
        ) : (
          <OrgChartWorkspaceReadyEmptyState
            onCompanySelect={handleCompanySelect}
            hasToken={!!hasToken}
            orgChartCredits={orgChartCredits}
          />
        )}
      </PageBody>
    </PageContainer>
  );
};
