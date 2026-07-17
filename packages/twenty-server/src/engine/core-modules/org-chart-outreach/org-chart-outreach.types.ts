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
  /** Unipile post id — required to comment on the post. */
  id?: string;
  /** LinkedIn activity urn (social id) of the post. */
  socialId?: string;
  shareUrl?: string;
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

export type IcpCandidateSource = 'apollo' | 'sales_navigator';

export type ExtractIcpParams = {
  /** Raw Unipile person profile JSON. When absent, personIdentifier is fetched via Unipile. */
  personProfile?: Record<string, unknown>;
  /** Raw Unipile company profile JSON. When absent, companyIdentifier is fetched via Unipile. */
  companyProfile?: Record<string, unknown>;
  /** LinkedIn public identifier or provider id of the person (e.g. "gaurav-sherlocks-ai"). */
  personIdentifier?: string;
  /**
   * LinkedIn company slug or numeric id (e.g. "sherlocks-ai" or "105905196").
   * When omitted along with companyProfile, the company_id of the person's
   * current work_experience entry is used instead.
   */
  companyIdentifier?: string;
  includePosts?: boolean;
  postsLimit?: number;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type ExtractIcpResponse = {
  sells: string;
  relevant_recipient_for_target_account_lure: boolean;
  reasoning: string;
  icp: {
    industry: string[];
    employee_range: string;
    tech_stack_signals: string[];
    buyer_titles: string[];
    pain_signals: string[];
  };
  chart_function: string | null;
  contextUsed: {
    personSource: 'provided' | 'unipile';
    /**
     * 'person_only' means no company profile could be derived or fetched;
     * the ICP was inferred from the person's headline/summary/roles alone.
     */
    companySource: 'provided' | 'unipile' | 'derived_from_person' | 'person_only';
    /** Set when the company was resolved from the person's current role. */
    derivedCompanyIdentifier?: string;
    postsCount: number;
  };
};

export type IcpCandidateCompany = {
  name: string;
  source: IcpCandidateSource;
  id?: string;
  industry?: string;
  headcount?: string;
  employeeCount?: number;
  location?: string;
  domain?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  keywords?: string[];
  technologies?: string[];
};

export type FetchIcpCandidatesParams = {
  icp: {
    industry: string[];
    employee_range: string;
    tech_stack_signals: string[];
    buyer_titles: string[];
    pain_signals: string[];
  };
  chartFunction?: string | null;
  source: IcpCandidateSource;
  /** Overrides the keywords derived from the ICP for the company search. */
  keywords?: string;
  locations?: string[];
  limit?: number;
  /** Run the LLM ranking step (Prompt 2) on the fetched candidates. Defaults to true. */
  rank?: boolean;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type FetchIcpCandidatesResponse = {
  source: IcpCandidateSource;
  searchKeywords: string;
  candidates: IcpCandidateCompany[];
  ranking?: {
    proceed: boolean;
    reason?: string;
    ranked_candidates: Array<{
      company_name: string;
      fit_reasoning: string;
      chart_function: string;
    }>;
  };
};

/** A ranked candidate from the icp/candidates step, passed into message/comment generation. */
export type IcpRankedCandidateInput = {
  company_name: string;
  chart_function: string;
  fit_reasoning?: string;
};

export type IcpProfileInput = {
  industry: string[];
  employee_range: string;
  tech_stack_signals: string[];
  buyer_titles: string[];
  pain_signals: string[];
};

export type GenerateIcpMessageParams = {
  icp: IcpProfileInput;
  /** "sells" summary from icp/extract, grounds the message in what they do. */
  sells?: string;
  chartFunction?: string | null;
  /** LinkedIn public identifier or provider id of the message recipient. */
  targetIdentifier: string;
  messageType: OutreachMessageType;
  /** Ranked companies from icp/candidates to reference as the org-chart lure. */
  rankedCandidates?: IcpRankedCandidateInput[];
  /** Window for the "recent post" hook, in days. Defaults to 30. */
  recentPostDays?: number;
  postsLimit?: number;
  tone?: OutreachTone;
  customInstructions?: string;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type GenerateIcpMessageResponse = {
  messageType: OutreachMessageType;
  message: string;
  subject?: string;
  /** The post the message hooked on, when one existed within the window. */
  recentPostUsed: LinkedinPostSummary | null;
  contextUsed: {
    targetPublicIdentifier?: string;
    postsConsidered: number;
    postsWithinWindow: number;
    recentPostDays: number;
    rankedCandidatesCount: number;
  };
};

export type GenerateIcpCommentParams = {
  icp: IcpProfileInput;
  sells?: string;
  chartFunction?: string | null;
  /** Author of the post — used to fetch their latest post when postId/postText are absent. */
  personIdentifier?: string;
  /** Unipile post id or LinkedIn social id — fetched directly when given. */
  postId?: string;
  /** Raw post text, skips all fetching. */
  postText?: string;
  rankedCandidates?: IcpRankedCandidateInput[];
  /** Number of comment variants to generate (1-3). Defaults to 3. */
  variants?: number;
  /** Window for picking the author's latest post, in days. Defaults to 30. */
  recentPostDays?: number;
  customInstructions?: string;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type GenerateIcpCommentResponse = {
  comments: string[];
  /** The post the comments were written for (id present when fetched, so it can be sent). */
  post: LinkedinPostSummary;
  contextUsed: {
    postSource: 'provided_text' | 'fetched_by_id' | 'latest_from_person';
    authorIdentifier?: string;
    postsConsidered: number;
  };
};

export type SendPostCommentParams = {
  /** Unipile post id or LinkedIn social id to comment on. */
  postId: string;
  text: string;
  /** Reply to an existing comment instead of the post. */
  commentId?: string;
  mentions?: Array<{ name: string; profile_id: string; is_company?: boolean }>;
  externalLink?: string;
  asOrganization?: string;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type SendPostCommentResponse = {
  success: boolean;
  postId: string;
  accountId: string;
  unipileResponse: Record<string, unknown>;
};
