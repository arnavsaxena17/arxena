import { AppPath } from 'twenty-shared/types';

export const UNTESTED_APP_PATHS = [
  AppPath.Settings,
  AppPath.Developers,
  // Public, unauthenticated redirect route handled in useCreateWorkspaceAppRouter
  // — not part of the onboarding/auth page-change navigation matrix.
  AppPath.Dpa,
  // Arxena product routes — not part of the onboarding/auth page-change matrix.
  AppPath.OrgChart,
  AppPath.Projects,
  AppPath.Project,
  AppPath.Search,
  AppPath.Assistant,
  AppPath.GtmHome,
  AppPath.ClientCandidateSearch,
  AppPath.VideoInterview,
  AppPath.VideoInterviewReview,
  AppPath.Hot,
  AppPath.GoogleSheet,
  AppPath.CustomLayoutCandidate,
  AppPath.CustomLayoutProject,
  AppPath.CustomLayoutMerged,
];
