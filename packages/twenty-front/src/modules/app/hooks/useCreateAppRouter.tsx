import {
  AppRouterProviders,
  MinimalProviders,
} from '@/app/components/AppRouterProviders';
import { SettingsRoutes } from '@/app/components/SettingsRoutes';

import { VerifyEffect } from '@/auth/components/VerifyEffect';
import { VerifyEmailEffect } from '@/auth/components/VerifyEmailEffect';
import { AppPath } from '@/types/AppPath';
import { BlankLayout } from '@/ui/layout/page/components/BlankLayout';
import { DefaultLayout } from '@/ui/layout/page/components/DefaultLayout';
import {
  Route,
  createBrowserRouter,
  createRoutesFromElements,
  useParams,
} from 'react-router-dom';
import { Authorize } from '~/pages/auth/Authorize';
import { PasswordReset } from '~/pages/auth/PasswordReset';
import { SignInUp } from '~/pages/auth/SignInUp';
import { NotFound } from '~/pages/not-found/NotFound';
import { RecordIndexPage } from '~/pages/object-record/RecordIndexPage';
import { RecordShowPage } from '~/pages/object-record/RecordShowPage';
import { ChooseYourPlan } from '~/pages/onboarding/ChooseYourPlan';
import { CreateProfile } from '~/pages/onboarding/CreateProfile';
import { CreateWorkspace } from '~/pages/onboarding/CreateWorkspace';
import { InviteTeam } from '~/pages/onboarding/InviteTeam';
import { PaymentSuccess } from '~/pages/onboarding/PaymentSuccess';
import { SyncEmails } from '~/pages/onboarding/SyncEmails';

import CustomLayoutCandidate from '@/custom-layouts/components/custom-layout-candidate';
import CustomLayoutJob from '@/custom-layouts/components/custom-layout-job';
import CustomLayoutMerged from '@/custom-layouts/components/custom-layout-merged';
import GoogleSheet from '@/google-sheet/GoogleSheet';
import { HotPage } from '@/hot/hotCandidates';
import Interview from '@/interviews/components/Interviews';
import indexAppPath from '@/navigation/utils/indexAppPath';
// import OrgChart from '@/orgchart/OrgChart';
import VideoInterviewFlow from '@/video-interview/interview-response/VideoInterviewFlow';
import VideoInterviewResponseViewer from '@/video-interview/interview-response/VideoInterviewResponseViewer';
import React from 'react';
import { Chats } from '~/pages/chats/Chats';
import { Dashboard } from '@/client-dashboard/components/Dashboard';
const OrgChart = React.lazy(() => import('@/orgchart/OrgChart'));

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
            <Route
              path={`${AppPath.VideoInterview}/:interviewId`}
              element={<VideoInterviewWrapper />}
            />
            <Route
              path="/test-param/:interviewId"
              element={<TestParamRoute />}
            />

            <Route
              path={`${AppPath.GoogleSheet}/*`}
              element={<GoogleSheet />}
            />
          <Route path={`${AppPath.OrgChart}/*`} element={
            <React.Suspense fallback={<div>Loading organization chart...</div>}>
              <OrgChart />
            </React.Suspense>
          } />
            <Route path={`${AppPath.Hot}/*`} element={<HotPage />} />
          </Route>
        </Route>
        <Route
          element={<AppRouterProviders />}
          loader={async () => Promise.resolve(null)}
        >
          <Route element={<DefaultLayout />}>
            <Route path={AppPath.Verify} element={<VerifyEffect />} />
            <Route path={AppPath.VerifyEmail} element={<VerifyEmailEffect />} />
            <Route path={AppPath.SignInUp} element={<SignInUp />} />
            <Route path={AppPath.Invite} element={<SignInUp />} />
            <Route path={AppPath.ResetPassword} element={<PasswordReset />} />
            <Route
              path={AppPath.CreateWorkspace}
              element={<CreateWorkspace />}
            />
            <Route path={AppPath.CreateProfile} element={<CreateProfile />} />
            <Route path={AppPath.SyncEmails} element={<SyncEmails />} />
            <Route path={AppPath.InviteTeam} element={<InviteTeam />} />
            <Route path={AppPath.Chats} element={<Chats />} />
            <Route path={AppPath.Interview} element={<Interview />} />
            <Route
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
            />
            <Route path={`${AppPath.Chats}/:candidateId`} element={<Chats />} />

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
