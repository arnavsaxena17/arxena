export type WarmPathNetworkPerson = {
  publicIdentifier: string;
  fullName: string;
  headline: string | null;
  linkedinUrl: string;
  providerId: string;
  sharedConnectionsWithViewer: number | null;
  networkDistanceToViewer: string | null;
};

export type WarmPathRelevance = {
  score: number;
  reasons: string[];
};

export type WarmPathRankedBridge = WarmPathNetworkPerson & {
  relevanceToTarget: WarmPathRelevance;
  viewerFirstDegreeConnectors: WarmPathNetworkPerson[];
};

export type WarmPathHop = {
  role: 'viewer' | 'connector' | 'bridge' | 'target';
  person: WarmPathNetworkPerson;
};

export type WarmPathEntry = {
  hopCount: number;
  pathType: 'direct_mutual' | 'bridge' | 'company_colleague';
  hops: WarmPathHop[];
  confidence: 'high' | 'medium' | 'low';
  summary: string;
};

export type WarmPathNetworkCluster = {
  label: string;
  members: WarmPathNetworkPerson[];
};

export type WarmPathTargetSummary = {
  linkedinUrl: string;
  publicIdentifier: string;
  providerId: string;
  fullName: string;
  headline: string | null;
  location: string | null;
  currentCompanyName: string | null;
  schools: string[];
  connectionsCount: number | null;
};

export type WarmPathViewerSummary = {
  workspaceMemberProfileId: string;
  fullName: string;
  linkedinUrl: string | null;
  linkedinUnipileAccountId: string;
};

export type WarmPathHonesty = {
  isDirectlyConnected: boolean;
  networkDistance: string | null;
  directMutualCount: number;
  suggestedDisclosure: string;
};

export type WarmPathResolveResponse = {
  target: WarmPathTargetSummary;
  viewer: WarmPathViewerSummary;
  honesty: WarmPathHonesty;
  directMutuals: WarmPathNetworkPerson[];
  bridges: WarmPathRankedBridge[];
  paths: WarmPathEntry[];
  anchorConnections: Array<{
    person: WarmPathNetworkPerson;
    whyKnownToTarget: string[];
    overlapWithViewer: {
      sharedConnectionCount: number | null;
      strength: 'very_high' | 'high' | 'moderate' | 'low';
    };
    optionalIntroChain?: {
      viewerFirstDegree: WarmPathNetworkPerson;
      bridge: WarmPathNetworkPerson;
    };
  }>;
  clusters: WarmPathNetworkCluster[];
  bestRouteLabel: string | null;
  searchApiUsed: 'classic' | 'sales_navigator';
  resolvedAt: string;
};

export type ResolveWarmPathsParams = {
  targetLinkedinUrl: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
  linkedinUnipileAccountId?: string;
  maxBridges?: number;
  expandViewerConnectors?: boolean;
};
