export type OutreachMessageType = 'connection_request' | 'inmail' | 'message';

export type OutreachTone = 'professional' | 'warm' | 'direct';

export type GenerateOutreachMessageParams = {
  targetIdentifier: string;
  messageType: OutreachMessageType;
  includeOrgChartLinks?: boolean;
  includePosts?: boolean;
  includeComments?: boolean;
  postsLimit?: number;
  commentsLimit?: number;
  accountId?: string;
  refreshSenderProfile?: boolean;
  tone?: OutreachTone;
  customInstructions?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type SuggestedOutreachCompany = {
  name: string;
  rationale: string;
  linkedinSlug?: string;
  linkedinCompanyUrl?: string;
  orgChartUrl?: string;
  parameterId?: string;
};

export type GenerateOutreachMessageResponse = {
  messageType: OutreachMessageType;
  connectionNote?: string;
  subject?: string;
  message: string;
  suggestedCompanies: SuggestedOutreachCompany[];
  contextUsed: {
    senderPublicIdentifier?: string;
    targetPublicIdentifier?: string;
    senderProfileFromCache: boolean;
    postsCount: number;
    commentsCount: number;
  };
};

export type OutreachCompanySelectionLlmResult = {
  companies: Array<{ name: string; rationale: string }>;
  excludedReason?: string;
};

export type OutreachConnectionRequestLlmResult = {
  message: string;
};

export type OutreachInmailLlmResult = {
  subject: string;
  message: string;
};

export type OutreachDirectMessageLlmResult = {
  message: string;
};

export type LinkedinProfileSummary = {
  publicIdentifier?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  location?: string;
  summary?: string;
  currentRole?: {
    company?: string;
    position?: string;
    location?: string;
  };
  recentExperience: Array<{
    company?: string;
    position?: string;
    start?: string;
    end?: string | null;
    description?: string;
  }>;
  skills: string[];
};

export type LinkedinPostSummary = {
  text: string;
  parsedDatetime?: string;
  isRepost: boolean;
};

export type LinkedinCommentSummary = {
  text: string;
  date?: string;
};

export type OutreachProfileContext = {
  sender: LinkedinProfileSummary;
  target: LinkedinProfileSummary;
  posts: LinkedinPostSummary[];
  comments: LinkedinCommentSummary[];
};
