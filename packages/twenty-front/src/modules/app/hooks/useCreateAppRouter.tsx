import {
  AppRouterProviders,
  MinimalProviders,
} from '@/app/components/AppRouterProviders';
import { SettingsRoutes } from '@/app/components/SettingsRoutes';

import { VerifyEffect } from '@/auth/components/VerifyEffect';
import { VerifyEmailEffect } from '@/auth/components/VerifyEmailEffect';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { RouteErrorBoundary } from '@/error-handler/components/RouteErrorBoundary';
import { AppPath } from '@/types/AppPath';
import { BlankLayout } from '@/ui/layout/page/components/BlankLayout';
import { DefaultLayout } from '@/ui/layout/page/components/DefaultLayout';
import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { getPostAuthLandingAppPath } from '~/config';
import { Authorize } from '~/pages/auth/Authorize';
import { PasswordReset } from '~/pages/auth/PasswordReset';
import { SignInUp } from '~/pages/auth/SignInUp';
import { NotFound } from '~/pages/not-found/NotFound';
import { RecordIndexPage } from '~/pages/object-record/RecordIndexPage';
import { RecordShowPage } from '~/pages/object-record/RecordShowPage';
import { ChooseYourPlan } from '~/pages/onboarding/ChooseYourPlan';
import { CollectPhoneNumber } from '~/pages/onboarding/CollectPhoneNumber';
import { CompetitiveResearchOnboarding } from '~/pages/onboarding/CompetitiveResearchOnboarding';
import { ConnectLinkedin } from '~/pages/onboarding/ConnectLinkedin';
import { CorporateTaOnboarding } from '~/pages/onboarding/CorporateTaOnboarding';
import { CreateProfile } from '~/pages/onboarding/CreateProfile';
import { CreateWorkspace } from '~/pages/onboarding/CreateWorkspace';
import { DealDiligenceOnboarding } from '~/pages/onboarding/DealDiligenceOnboarding';
import { ExtensionInstallOnboarding } from '~/pages/onboarding/ExtensionInstallOnboarding';
import { IntentChoice } from '~/pages/onboarding/IntentChoice';
import { InviteTeam } from '~/pages/onboarding/InviteTeam';
import { PaymentSuccess } from '~/pages/onboarding/PaymentSuccess';
import { SyncEmails } from '~/pages/onboarding/SyncEmails';

import { AssistantPage } from '@/assistant/components/AssistantPage';
import { Search } from '@/candidate-search/Search';
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { JobPage } from '@/candidate-table/JobPage';
import { Jobs } from '@/candidate-table/Jobs';
import GoogleSheet from '@/google-sheet/GoogleSheet';
import { HotPage } from '@/hot/hotCandidates';
import Interview from '@/interviews/components/Interviews';
import indexAppPath from '@/navigation/utils/indexAppPath';
import { OrgChartWorkspaceReadyEmptyState } from '@/orgchart/components/OrgChartWorkspaceReadyEmptyState';
import { orgChartSelectionSearch } from '@/orgchart/utils/orgChartUtils';
// import OrgChart from '@/orgchart/OrgChart';
import { useBaileysConnection } from '@/baileys/contexts/BaileysContext';
import { SearchModels } from '@/search-models/SearchModels';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { useUnipile } from '@/unipile/contexts/UnipileContext';
import VideoInterviewFlow from '@/video-interview/interview-response/VideoInterviewFlow';
import VideoInterviewResponseViewer from '@/video-interview/interview-response/VideoInterviewResponseViewer';
import { useQuery } from '@apollo/client';
import React, { useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import {
  buildCanonicalOrgChartPath,
  resolveOrgChartCanonicalCompanyId,
  shouldRedirectOrgChartCompanySlug,
} from 'twenty-shared';
import { IconDatabase } from 'twenty-ui';
import { WORKSPACE_CREDITS } from '~/modules/billing/graphql/workspaceCredits';

const ArxOrgChart = React.lazy(() =>
  import('@/orgchart/ArxOrgChart').then((m) => ({ default: m.ArxOrgChart })),
);

const VideoInterviewWrapper = () => {
  console.log('VideoInterviewWrapper rendering');
  const params = useParams();
  console.log('Raw params object:', params);
  const { interviewId } = params;
  console.log('Extracted interviewId:', interviewId);

  // Check browser URL directly
  console.log('Current URL path:', window.location.pathname);

  // Extract ID manually as fallback
  const pathParts = window.location.pathname.split('/');
  const manuallyExtractedId = pathParts[pathParts.length - 1];
  console.log('Manually extracted ID:', manuallyExtractedId);

  return (
    <VideoInterviewFlow
      interviewId={interviewId || manuallyExtractedId || ''}
    />
  );
};

const TestParamRoute = () => {
  const { interviewId } = useParams();
  return <div>Parameter value: {interviewId || 'No parameter found'}</div>;
};

const VideoInterviewResponseViewerWrapper = () => {
  const { videoInterviewId } = useParams();
  return <VideoInterviewResponseViewer videoInterviewId={videoInterviewId} />;
};

const OrgChartRoute = () => {
  const { companyKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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

  const routeState = location.state as OrgChartRouteLocationState | null;

  const tokenPair = useRecoilValue(tokenPairState);
  const hasToken = Boolean(tokenPair?.accessToken?.token);
  const { data: creditsData } = useQuery(WORKSPACE_CREDITS);
  const credits = (
    creditsData as
      | {
          workspaceCredits?: {
            orgChartCredits: number;
            revealCredits: number;
            revealCreditsAsEmailEquivalent?: number;
            revealCreditsAsPhoneEquivalent?: number;
            emailRevealCost?: number;
            phoneRevealCost?: number;
          };
        }
      | undefined
  )?.workspaceCredits;
  const orgChartCredits = credits?.orgChartCredits;
  const revealCredits = credits?.revealCredits;
  const revealCreditsAsEmailEquivalent = credits?.revealCreditsAsEmailEquivalent;
  const revealCreditsAsPhoneEquivalent = credits?.revealCreditsAsPhoneEquivalent;
  const emailRevealCost = credits?.emailRevealCost;
  const phoneRevealCost = credits?.phoneRevealCost;
  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;

  const companyFromState = routeState?.company;

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
    navigate(`/${getPostAuthLandingAppPath()}`);
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
    navigate(`/${AppPath.Jobs}`);
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
        isExtensionInstalled={false}
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
          <React.Suspense fallback={null}>
            <ArxOrgChart
              companyId={companyId}
              companyName={companyFromState?.companyName}
              website={companyFromState?.website}
              locationName={companyFromState?.locationName}
              industry={companyFromState?.industry}
              profileCount={companyFromState?.profileCount}
              linkedinUrl={companyFromState?.linkedinUrl}
              companyDomain={companyFromState?.companyDomain}
              onBack={handleBack}
            />
          </React.Suspense>
        ) : (
          <OrgChartWorkspaceReadyEmptyState
            onCompanySelect={handleCompanySelect}
            hasToken={hasToken}
            orgChartCredits={orgChartCredits}
          />
        )}
      </PageBody>
    </PageContainer>
  );
};

export const useCreateAppRouter = (
  isFunctionSettingsEnabled?: boolean,
  isAdminPageEnabled?: boolean,
) =>
  createBrowserRouter(
    createRoutesFromElements(
      <>
        {/* Special routes with MinimalProviders */}
        <Route element={<MinimalProviders />}>
          <Route element={<BlankLayout />}>
            <Route path={`${AppPath.VideoInterview}/:interviewId`} element={<VideoInterviewWrapper />} />
            <Route path="/test-param/:interviewId" element={<TestParamRoute />} />

            <Route path={`${AppPath.GoogleSheet}/*`} element={<GoogleSheet />} />
            <Route path={`${AppPath.Hot}/*`} element={<HotPage />} />
          </Route>
        </Route>
        <Route
          element={<AppRouterProviders />}
          loader={async () => Promise.resolve(null)}
          errorElement={<RouteErrorBoundary />}
        >
          <Route element={<DefaultLayout />}>
            <Route path={AppPath.Verify} element={<VerifyEffect />} />
            <Route path={AppPath.VerifyEmail} element={<VerifyEmailEffect />} />
            <Route path={AppPath.SignInUp} element={<SignInUp />} />
            <Route path={AppPath.Invite} element={<SignInUp />} />
            <Route path={AppPath.ResetPassword} element={<PasswordReset />} />
            <Route path={AppPath.CreateWorkspace} element={<CreateWorkspace />} />
            <Route path={AppPath.CreateProfile} element={<CreateProfile />} />
            <Route
              path={AppPath.CollectPhoneNumber}
              element={<CollectPhoneNumber />}
            />
            <Route path={AppPath.IntentChoice} element={<IntentChoice />} />
            <Route
              path={AppPath.CompetitiveResearchOnboarding}
              element={<CompetitiveResearchOnboarding />}
            />
            <Route
              path={AppPath.CorporateTaOnboarding}
              element={<CorporateTaOnboarding />}
            />
            <Route
              path={AppPath.DealDiligenceOnboarding}
              element={<DealDiligenceOnboarding />}
            />
            <Route
              path={AppPath.ExtensionInstallOnboarding}
              element={<ExtensionInstallOnboarding />}
            />
            <Route
              path={AppPath.ConnectLinkedin}
              element={<ConnectLinkedin />}
            />
            <Route path={AppPath.SyncEmails} element={<SyncEmails />} />
            <Route path={AppPath.InviteTeam} element={<InviteTeam />} />
            <Route path={AppPath.Jobs} element={<Jobs />} />
            <Route path={AppPath.Search} element={<Search />} />
            <Route
              path={`${AppPath.OrgChart}/:companyKey?`}
              element={
                <React.Suspense
                  fallback={<div>Loading organization chart...</div>}
                >
                  <OrgChartRoute />
                </React.Suspense>
              }
            />
            <Route path={`${AppPath.Jobs}/:candidateId`} element={<Jobs />} />
            <Route path={AppPath.Interview} element={<Interview />} />
            {/* <Route
              path={AppPath.Dashboard}
              element={<Dashboard />}
            />
            <Route
              path={AppPath.CustomLayoutCandidate}
              element={<CustomLayoutCandidate />}
            />
            <Route
              path={AppPath.CustomLayoutJob}
              element={<CustomLayoutJob />}
            />
            <Route
              path={AppPath.CustomLayoutMerged}
              element={<CustomLayoutMerged />}
            /> */}
            {/* <Route path="job/:jobId" element={<SingleJobView />} />
            <Route path="job/:jobId/:candidateId" element={<SingleJobView />} /> */}
            <Route path="job/:jobId" element={<JobPage />} />
            <Route path="job/:jobId/:candidateId" element={<JobPage />} />
            <Route path="search-models" element={<SearchModels />} />
            <Route path={AppPath.Assistant} element={<AssistantPage />} />

            <Route
              path={`${AppPath.VideoInterviewReview}/:candidateId`}
              element={<VideoInterviewResponseViewerWrapper />}
            />

            <Route path={AppPath.PlanRequired} element={<ChooseYourPlan />} />
            <Route
              path={AppPath.PlanRequiredSuccess}
              element={<PaymentSuccess />}
            />
            <Route path={indexAppPath.getIndexAppPath()} element={<></>} />
            <Route
              path={AppPath.RecordIndexPage}
              element={<RecordIndexPage />}
            />
            <Route path={AppPath.RecordShowPage} element={<RecordShowPage />} />
            <Route
              path={AppPath.SettingsCatchAll}
              element={
                <SettingsRoutes
                  isFunctionSettingsEnabled={isFunctionSettingsEnabled}
                  isAdminPageEnabled={isAdminPageEnabled}
                />
              }
            />
            <Route path={AppPath.NotFoundWildcard} element={<NotFound />} />
          </Route>
          <Route element={<BlankLayout />}>
            <Route path={AppPath.Authorize} element={<Authorize />} />
          </Route>
        </Route>
        ,
      </>,
    ),
  );
