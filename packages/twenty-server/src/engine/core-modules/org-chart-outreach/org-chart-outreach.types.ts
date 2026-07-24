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

export type MomTestHypothesisTag = 'T' | 'M' | 'M-r' | 'V';

export type MomTestCoreQuestion = {
  question: string;
  tag: MomTestHypothesisTag;
  /** What answer pattern would confirm vs kill the tagged hypothesis. */
  listen_for: string;
};

export type MomTestMoneyProbe = {
  question: string;
  tag: MomTestHypothesisTag;
};

/** Mom Test discovery questions generated alongside ICP extract. */
export type MomTestQuestions = {
  persona_read: string;
  core_questions: MomTestCoreQuestion[];
  money_probes: MomTestMoneyProbe[];
  trap_check: string;
};

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
  /**
   * Generate Mom Test discovery questions from the person's profile (as resume).
   * Defaults to true.
   */
  includeMomTestQuestions?: boolean;
  /**
   * Per-person context for Mom Test (kept out of the system prompt).
   * E.g. "rejected candidate, interviewed 2 months ago, warm relationship".
   */
  interviewContext?: string;
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
  /** Present when includeMomTestQuestions is true (default). */
  momTestQuestions?: MomTestQuestions;
  contextUsed: {
    personSource: 'provided' | 'unipile' | 'resume';
    /**
     * 'person_only' means no company profile could be derived or fetched;
     * the ICP was inferred from the person's headline/summary/roles alone.
     * 'web_search' means company details came from LLM web search (resume path).
     */
    companySource:
      | 'provided'
      | 'unipile'
      | 'derived_from_person'
      | 'person_only'
      | 'web_search';
    /** Set when the company was resolved from the person's current role. */
    derivedCompanyIdentifier?: string;
    postsCount: number;
    momTestQuestionsGenerated?: boolean;
    /** Present when ICP was extracted from an uploaded / pasted resume. */
    resumeFileName?: string;
    linkedinUrlFromResume?: string;
  };
};

export type ExtractIcpFromResumeParams = {
  /** Absolute path to a local PDF/DOCX/DOC resume on the server filesystem. */
  resumeFilePath?: string;
  /** Raw resume text when no local file path is provided. */
  resumeText?: string;
  includePosts?: boolean;
  postsLimit?: number;
  includeMomTestQuestions?: boolean;
  interviewContext?: string;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type ExtractIcpFromResumeResponse = ExtractIcpResponse & {
  parsedResume: {
    name?: string;
    email?: string;
    linkedinUrl?: string | null;
    currentCompany?: string | null;
    currentRole?: string | null;
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

/** Channels the ICP outreach composer can write for. */
export type IcpChannelMessageType = OutreachMessageType | 'email' | 'whatsapp';

/** Outcome of an executed send (present only when `execute` was requested). */
export type IcpExecutionResult = {
  attempted: boolean;
  success: boolean;
  error?: string;
};

export type GenerateIcpMessageParams = {
  /** ICP from icp/extract. When omitted, extracted automatically from the target's profile. */
  icp?: IcpProfileInput;
  /** "sells" summary from icp/extract, grounds the message in what they do. */
  sells?: string;
  chartFunction?: string | null;
  /** LinkedIn public identifier, provider id, or full profile URL of the recipient. */
  targetIdentifier: string;
  messageType: OutreachMessageType;
  /** Ranked companies from icp/candidates to reference as the org-chart lure. */
  rankedCandidates?: IcpRankedCandidateInput[];
  /** Window for the "recent post" hook, in days. Defaults to 30. */
  recentPostDays?: number;
  postsLimit?: number;
  tone?: OutreachTone;
  customInstructions?: string;
  /** Send the connection request after generation (connection_request only). */
  execute?: boolean;
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
  /** Echoed back when the ICP was auto-extracted, so clients can reuse it. */
  icp?: IcpProfileInput;
  contextUsed: {
    targetPublicIdentifier?: string;
    postsConsidered: number;
    postsWithinWindow: number;
    recentPostDays: number;
    rankedCandidatesCount: number;
    icpSource: 'provided' | 'extracted';
  };
  execution?: IcpExecutionResult;
};

export type GenerateIcpCommentParams = {
  /** ICP from icp/extract. When omitted, extracted automatically from the post author's profile. */
  icp?: IcpProfileInput;
  sells?: string;
  chartFunction?: string | null;
  /**
   * Author of the post — public identifier, provider id, or full profile URL.
   * Used to fetch their latest post when postId/postText are absent.
   */
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
  /** Publish the first generated comment on the resolved post. */
  execute?: boolean;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type GenerateIcpCommentResponse = {
  comments: string[];
  /** The post the comments were written for (id present when fetched, so it can be sent). */
  post: LinkedinPostSummary;
  /** Echoed back when the ICP was auto-extracted, so clients can reuse it. */
  icp?: IcpProfileInput;
  contextUsed: {
    postSource: 'provided_text' | 'fetched_by_id' | 'latest_from_person';
    authorIdentifier?: string;
    postsConsidered: number;
    icpSource: 'provided' | 'extracted';
  };
  execution?: IcpExecutionResult & { commentText?: string; postId?: string };
};

export type GenerateIcpChannelParams = {
  /** ICP from icp/extract. When omitted, extracted automatically from the target's profile. */
  icp?: IcpProfileInput;
  sells?: string;
  chartFunction?: string | null;
  /** LinkedIn public identifier, provider id, or full profile URL of the recipient. */
  targetIdentifier: string;
  rankedCandidates?: IcpRankedCandidateInput[];
  recentPostDays?: number;
  postsLimit?: number;
  tone?: OutreachTone;
  customInstructions?: string;
  execute?: boolean;
  accountId?: string;
  apiToken: string;
  workspaceMemberId: string;
  workspaceId: string;
};

export type GenerateIcpEmailParams = GenerateIcpChannelParams & {
  /** Recipient email — skips the contact-enrichment waterfall when provided. */
  email?: string;
};

export type GenerateIcpWhatsappParams = GenerateIcpChannelParams & {
  /** Recipient phone — skips the contact-enrichment waterfall when provided. */
  phone?: string;
};

type IcpChannelContextUsed = {
  targetPublicIdentifier?: string;
  postsConsidered: number;
  postsWithinWindow: number;
  recentPostDays: number;
  rankedCandidatesCount: number;
  icpSource: 'provided' | 'extracted';
};

export type GenerateIcpEmailResponse = {
  subject: string;
  message: string;
  /** Address the email would be (or was) sent to. */
  toEmail?: string;
  /** Contact-enrichment waterfall output ('provided' when the caller passed the email). */
  contact: { emails: string[]; source: string };
  recentPostUsed: LinkedinPostSummary | null;
  icp?: IcpProfileInput;
  contextUsed: IcpChannelContextUsed;
  execution?: IcpExecutionResult;
};

export type GenerateIcpWhatsappResponse = {
  message: string;
  /** Phone the message would be (or was) sent to. */
  toPhone?: string;
  /** Contact-enrichment waterfall output ('provided' when the caller passed the phone). */
  contact: { phones: string[]; source: string };
  recentPostUsed: LinkedinPostSummary | null;
  icp?: IcpProfileInput;
  contextUsed: IcpChannelContextUsed;
  execution?: IcpExecutionResult;
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
