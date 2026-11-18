export type OutreachStage =
  | 'QUEUED'
  | 'NEEDS_CONNECTION'
  | 'CONNECTION_SENT'
  | 'CONNECTION_ACCEPTED'
  | 'CONNECTION_IGNORED'
  | 'PROFILE_CHECKED'
  | 'WARM_PATH'
  | 'COMMENTED'
  | 'EMAIL_ENRICHING'
  | 'EMAIL_SENT'
  | 'INMAIL_SENT'
  | 'WHATSAPP_SENT'
  | 'FOLLOW_UP_1'
  | 'FOLLOW_UP_2'
  | 'FOLLOW_UP_3'
  | 'WAITING_REPLY'
  | 'DEFERRED'
  | 'STOPPED'
  | 'REPLIED'
  | 'NEGOTIATING'
  | 'MEETING_BOOKED'
  | 'FAILED_NO_REPLY'
  | 'FAILED_ENRICH';

export type OutreachMainTab = 'companies' | 'people' | 'setup';

export type OutreachSendMode = 'AUTO' | 'APPROVAL';

export type OutreachWorkspaceCompany = {
  name: string;
  domain: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
};

/** Structured ICP stored in `icpSpec` JSON (core Workspace / Project). */
export type IcpSpec = {
  targetTitles: string[];
  locations: string[];
};

export type OutreachCompanyRow = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: string;
  segment: string;
  icpFit: string;
  status: string;
  // AI filter / enrichment columns, one key per column.
  otherFields?: unknown;
};

export type OutreachPersonRow = {
  id: string;
  name: string;
  /** Current role from experience / current_positions (company-matched when scoped). */
  title: string;
  /** LinkedIn profile headline — distinct from title. */
  headline?: string;
  /** LinkedIn About / summary — distinct from headline and title. */
  summary?: string;
  companyId: string;
  companyName: string;
  linkedinUrl: string;
  warmPath: string;
  stage: OutreachStage;
  /** ATS / recruiter pipeline status (NOT outreach sequence stage). */
  recruiterStatus?: string;
  /** Bot / conversation status (recruiter messaging). */
  candConversationStatus?: string;
  /** Active outreach workflow run status (RUNNING, STOPPED, …). */
  workflowRunStatus?: string | null;
  email: string;
  locationName?: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
  doNotContact?: boolean;
  pendingChannel?: string;
  candidateId?: string;
  /** From Candidate.candidateFlags — not Person fields. */
  candidateFlags?: {
    startOutreach?: boolean;
    stopOutreach?: boolean;
  };
  experimentVariant?: 'A' | 'B' | null;
  nextStepLabel?: string;
  nextRetryAt?: string | null;
  linkedinFollowUpCount?: number;
  outreachResumeAt?: string | null;
  needsApproval?: boolean;
  messagesExchanged?: string;
  outreachConversationStage?: string;
  lastInboundCopy?: string;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  replyAfterTouch?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  otherFields?: unknown;
  jobSpecificFields?: unknown;
  outreachAnalytics?: unknown;
  outreachProspectEnrichment?: unknown;
  linkedinProfile?: unknown;
  linkedinPosts?: unknown;
};

export type OutreachProjectOption = {
  id: string;
  name: string;
  icpSegment: string | null;
};

export type OutreachStatus = 'LIVE' | 'PAUSED';

export type OutreachProjectSettings = {
  projectId: string | null;
  projectName: string | null;
  outreachWorkflowId: string | null;
  outreachStatus: OutreachStatus;
  outreachSendMode: OutreachSendMode;
  outreachConfig: unknown;
  maxPersonasPerCompany: number;
  inMailFallbackEnabled: boolean;
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  sendWindowDays: string;
  whatsappConnected: boolean;
  icpSpec: string | null;
  isIcpProjectOverride: boolean;
  experimentConfig: string | null;
};

export type OutreachProjectRecord = {
  id: string;
  name?: string | null;
  outreachWorkflowId?: string | null;
  outreachStatus?: string | null;
  outreachSendMode?: string | null;
  outreachConfig?: unknown;
  maxPersonasPerCompany?: number | null;
  inMailFallbackEnabled?: boolean | null;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  sendWindowDays?: string | null;
  icpSpec?: string | null;
  experimentConfig?: string | null;
};

export type OutreachContext = {
  projectId: string | null;
  projectName: string | null;
  outreachWorkflowId: string | null;
  outreachSendMode: OutreachSendMode;
  selectedCompanyId: string | null;
  selectedPersonId: string | null;
  // Checked rows on the People tab (falls back to the active row)
  selectedPersonIds: string[];
  selectedCandidateIds: string[];
  selectedCandidateStage: OutreachStage | null;
  icpName: string | null;
  icpSpecSummary: string | null;
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected: boolean;
  // The tab the user is looking at (people, companies or setup)
  activeTab: string | null;
  phase: string | null;
};
