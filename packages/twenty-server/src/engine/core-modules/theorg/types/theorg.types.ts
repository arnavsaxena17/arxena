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
  nodeId: string;
  parentNodeId: string | null;
  section: string | null;
  reportCount: number;
  profileUrl: string | null;
  profile?: Record<string, unknown>;
  profileError?: string;
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
  includePeopleProfiles: boolean;
  peopleProfilesDeferred: boolean;
  peopleProfileFetchConcurrency: number;
  inlineProfileMaxPeople: number;
  nodes: TheOrgNormalizedNode[];
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
