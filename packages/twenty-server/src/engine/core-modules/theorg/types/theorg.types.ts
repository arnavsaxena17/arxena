export type TheOrgImage = {
  endpoint?: string | null;
  ext?: string | null;
  uri?: string | null;
  versions?: string[] | null;
};

export type TheOrgSocial = {
  twitterUrl?: string | null;
  linkedInUrl?: string | null;
  facebookUrl?: string | null;
  websiteUrl?: string | null;
};

export type TheOrgFetchMode = 'teams' | 'orgchart' | 'combined';

export type TheOrgNormalizedNode = {
  id: string;
  title: string | null;
  containingNodeId: string | null;
  order: number | null;
  parentId: string | null;
  section: string | null;
  type: string | null;
  reportCount: number;
  nodeType: 'Position' | 'Vacant' | null;
  position: {
    id: number;
    fullName: string | null;
    role: string | null;
    slug: string | null;
    claimedBy: unknown;
    hasNotes: boolean;
    profileImage: TheOrgImage | null;
    social: TheOrgSocial | null;
  } | null;
  job: {
    id: string | number;
    slug: string | null;
    title: string | null;
  } | null;
};

export type TheOrgPerson = {
  id: number;
  name: string;
  role: string | null;
  slug: string | null;
  nodeId?: string;
  parentNodeId?: string | null;
  section: string | null;
  reportCount?: number;
  /** The Org org-chart page URL — not LinkedIn */
  profileUrl: string | null;
  /** LinkedIn profile URL from position.social.linkedInUrl (or profile fetch when inlined) */
  linkedInUrl: string | null;
  source?: 'orgChart' | 'team';
  sources?: TheOrgFetchMode[];
  teamIds?: string[];
  teamSlugs?: string[];
  teamNames?: string[];
  profileImageUrl?: string | null;
  profile?: Record<string, unknown>;
  profileError?: string;
};

export type TheOrgTeamMember = {
  id: number;
  name: string;
  role: string | null;
  slug: string | null;
  parentPositionId: number | null;
  profileImageUrl: string | null;
  updatedAt: string | null;
};

export type TheOrgTeam = {
  id: string | null;
  slug: string | null;
  name: string | null;
  description: string | null;
  content?: string | null;
  memberCount: number;
  publishedJobsCount?: number;
  members: TheOrgTeamMember[];
  membersPreviewCount?: number;
  url: string;
  fetchError?: string;
};

export type TheOrgStorageLocation = {
  folderPath: string;
  filename: string;
  path: string;
};

export type TheOrgStorageTarget = {
  folderSegments?: string[];
  filename?: string;
};

export type TheOrgFetchCompanyOptions = {
  mode?: TheOrgFetchMode;
  includePeopleProfiles?: boolean;
  forceInlineProfiles?: boolean;
  persist?: boolean;
  storageTarget?: TheOrgStorageTarget;
};

export type TheOrgFetchPersonOptions = {
  persist?: boolean;
  storageTarget?: TheOrgStorageTarget;
};

export type TheOrgCompanyResponse = {
  inputName: string;
  companyName: string;
  slug: string;
  url: string;
  tags: string[];
  stats: Record<string, unknown> | null;
  ssrPeopleCount: number;
  fullNodeCount: number;
  fullTreeCrawled: boolean;
  partialResult: boolean;
  partialResultReason: string | null;
  mode: TheOrgFetchMode;
  includePeopleProfiles: boolean;
  peopleProfilesDeferred: boolean;
  peopleProfileFetchConcurrency: number;
  inlineProfileMaxPeople: number;
  maxFullTreePositionCount: number;
  teamCount: number;
  orgChartPeopleCount: number;
  teamPeopleCount: number;
  nodes: TheOrgNormalizedNode[];
  teams: TheOrgTeam[];
  orgChartPeople: TheOrgPerson[];
  teamPeople: TheOrgPerson[];
  people: TheOrgPerson[];
  storage?: TheOrgStorageLocation;
};

export type TheOrgAsyncJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type TheOrgAsyncJobProgress = {
  jobId: string;
  slug: string;
  workspaceId?: string;
  status: TheOrgAsyncJobStatus;
  total: number;
  completed: number;
  failed: number;
  storage?: TheOrgStorageLocation;
  result?: {
    companyName?: string;
    peopleCount?: number;
    includePeopleProfiles: boolean;
  };
  error?: string;
};
