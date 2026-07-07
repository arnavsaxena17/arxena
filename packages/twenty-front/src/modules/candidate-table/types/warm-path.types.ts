export type WarmPathNetworkPerson = {
  publicIdentifier: string;
  fullName: string;
  headline: string | null;
  linkedinUrl: string;
  providerId: string;
  sharedConnectionsWithViewer: number | null;
  networkDistanceToViewer: string | null;
};

export type WarmPathRankedBridge = WarmPathNetworkPerson & {
  relevanceToTarget: {
    score: number;
    reasons: string[];
  };
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

export type WarmPathResolveResponse = {
  target: {
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
  viewer: {
    workspaceMemberProfileId: string;
    fullName: string;
    linkedinUrl: string | null;
    linkedinUnipileAccountId: string;
  };
  honesty: {
    isDirectlyConnected: boolean;
    networkDistance: string | null;
    directMutualCount: number;
    suggestedDisclosure: string;
  };
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
  clusters: Array<{
    label: string;
    members: WarmPathNetworkPerson[];
  }>;
  bestRouteLabel: string | null;
  searchApiUsed: 'classic' | 'sales_navigator';
  resolvedAt: string;
};
