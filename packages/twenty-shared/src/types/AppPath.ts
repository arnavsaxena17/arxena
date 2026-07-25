export enum AppPath {
  // Not logged-in
  Verify = '/verify',
  VerifyEmail = '/verify-email',
  SignInUp = '/welcome',
  Invite = '/invite/:workspaceInviteHash',
  ResetPassword = '/reset-password/:passwordResetToken',

  // Onboarding
  WorkspaceActivation = '/workspace-activation',
  CreateProfile = '/create/profile',
  SyncEmails = '/sync/emails',
  InstallApps = '/install-apps',
  InviteTeam = '/invite-team',
  PlanRequired = '/plan-required',
  PlanRequiredSuccess = '/plan-required/payment-success',
  BookCall = '/book-call',

  // Onboarded
  WorkspaceSetup = '/workspace-setup',
  Index = '/',
  TasksPage = '/objects/tasks',
  OpportunitiesPage = '/objects/opportunities',

  RecordIndexPage = '/objects/:objectNamePlural',
  RecordShowPage = '/object/:objectNameSingular/:objectRecordId',
  PageLayoutPage = '/page/:pageLayoutId',

  Settings = `settings`,
  SettingsCatchAll = `/${Settings}/*`,
  Developers = `developers`,
  DevelopersCatchAll = `/${Developers}/*`,

  Authorize = '/authorize',

  // Deep link for twenty.com/dpa → in-app DPA generator (login-gated redirect).
  Dpa = '/dpa',

  // Arxena product routes (ported from workflows)
  OrgChart = 'org-chart',
  Projects = 'projects',
  Project = 'project/:projectId',
  Search = 'search',
  Assistant = 'assistant',
  ClientCandidateSearch = 'candidate-search',
  VideoInterview = 'video-interview',
  VideoInterviewReview = 'video-interview-review',
  Hot = 'hot',
  GoogleSheet = 'GoogleSheet',
  CustomLayoutCandidate = 'custom-layout-candidate',
  CustomLayoutProject = 'custom-layout-project',
  CustomLayoutMerged = 'custom-layout-merged',

  // 404 page not found
  NotFoundWildcard = '*',
  NotFound = '/not-found',
}
