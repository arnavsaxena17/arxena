export type OutreachStage =
  | 'queued'
  | 'needs_connection'
  | 'connection_sent'
  | 'connection_accepted'
  | 'connection_ignored'
  | 'profile_checked'
  | 'warm_path'
  | 'commented'
  | 'email_enriching'
  | 'email_sent'
  | 'inmail_sent'
  | 'deferred'
  | 'stopped'
  | 'replied'
  | 'negotiating'
  | 'meeting_booked';

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

/** Structured ICP stored in `icpSpec` JSON (workspaceProfile / Project). */
export type IcpSpec = {
  targetTitles: string[];
  locations: string[];
};

export type WorkspaceProfileRecord = {
  id: string;
  name?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  industry?: string | null;
  summary?: string | null;
  employeeRange?: string | null;
  hq?: string | null;
  icpSpec?: string | null;
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
};

export type OutreachPersonRow = {
  id: string;
  name: string;
  title: string;
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
  connectionDegree?: number;
  personaPriorityScore?: number;
  doNotContact?: boolean;
  pendingChannel?: string;
  candidateId?: string;
  experimentVariant?: 'A' | 'B' | null;
  nextStepLabel?: string;
  linkedinFollowUpCount?: number;
  outreachResumeAt?: string | null;
  needsApproval?: boolean;
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
  selectedCandidateStage: OutreachStage | null;
  icpName: string | null;
  icpSpecSummary: string | null;
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected: boolean;
  phase: string | null;
};

export const buildOutreachContextPrompt = (
  context: OutreachContext,
): string => {
  return [
    'You are helping with Outreach for this Project.',
    `projectId: ${context.projectId ?? 'none'}`,
    `projectName: ${context.projectName ?? 'none'}`,
    `outreachWorkflowId: ${context.outreachWorkflowId ?? 'none'}`,
    `sendMode: ${context.outreachSendMode}`,
    `phase: ${context.phase ?? 'live'}`,
    `selectedCompanyId: ${context.selectedCompanyId ?? 'none'}`,
    `selectedPersonId: ${context.selectedPersonId ?? 'none'}`,
    `selectedCandidateStage: ${context.selectedCandidateStage ?? 'none'}`,
    `icp: ${context.icpName ?? 'none'}`,
    `icpSpec: ${context.icpSpecSummary ?? 'none'}`,
    `channels: LinkedIn=${context.linkedinConnected} Gmail=${context.gmailConnected} WhatsApp=${context.whatsappConnected}`,
    'Target companies on /outreach-home are ephemeral (Find destination per projectId), not CRM membership.',
    'When the user asks to find/fetch/add/build target companies: load_skills(["search"]), search, then upsert_outreach_target_companies({ projectId, mode: "merge", companies }) before ending the turn. Do not stop at a chat-only list.',
    'Do NOT create CRM Company records for the Companies tab — only when enrolling people.',
    'Target people on the People tab are ephemeral (Find destination) until the user selects rows and confirms Add to CRM / Enroll.',
    'When the user asks to find/fetch/search people (target titles, MD/CEO, etc.) for this campaign: load_skills(["search"]), search, then upsert_outreach_target_people({ projectId, mode: "merge", people }) before ending the turn.',
    'Do NOT create_candidate / create_one_person / create_one_candidate for the People tab. Enrollment writes happen only after explicit user confirmation (Add to CRM / Enroll).',
    'When enrolling people (user confirmed), upsert shared CRM Company + Candidate with projectsId = this projectId.',
    'Prefer Candidate+Project execution; Person holds stop/compliance memory.',
    'Respect send windows, daily caps, stop-on-reply, and approval gates when editing steps.',
  ].join('\n');
};

export type IcpOnboardingKickoffInput = {
  workspaceCompany: OutreachWorkspaceCompany;
  projectId: string | null;
  projectName: string | null;
  proposedIcp?: IcpSpec | null;
};

export const buildIcpOnboardingKickoffPrompt = (
  input: IcpOnboardingKickoffInput,
): string => {
  const company = input.workspaceCompany;
  const projectLabel = input.projectName
    ? `"${input.projectName}"`
    : input.projectId
      ? `this project`
      : 'a new project';

  const companyBlurb = [
    `We're ${company.name} (${company.domain})`,
    company.industry ? `in ${company.industry}` : null,
    company.employeeRange ? `${company.employeeRange} people` : null,
    company.hq ? `HQ ${company.hq} ` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const proposedIcp = input.proposedIcp;
  const draftLines = proposedIcp
    ? [
        '',
        'Current ICP draft:',
        proposedIcp.targetTitles.length > 0
          ? `- Target titles: ${proposedIcp.targetTitles.join(', ')}`
          : null,
        proposedIcp.locations.length > 0
          ? `- Locations: ${proposedIcp.locations.join(', ')}`
          : null,
      ].filter(Boolean)
    : [];

  return [
    `Hey — help me set up ICP and outreach preferences for ${projectLabel}.`,
    companyBlurb +
      '. Walk me through who we should reach (target titles and locations), send mode (approval vs auto), and caps — ask questions as we go.',
    'When we agree, save the default ICP as icpSpec JSON on workspaceProfile (targetTitles + locations only). Only write Project.icpSpec if I ask for a project-specific override.',
    ...draftLines,
  ].join('\n');
};

export type FindCompaniesSendPromptInput = {
  projectId: string | null;
  icpSpecSummary: string | null;
};

export const buildFindCompaniesSendPrompt = (
  input: FindCompaniesSendPromptInput,
): string => {
  return [
    `Find target companies for this project (projectId=${input.projectId ?? 'none'}).`,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : 'Use the workspace ICP target titles and locations if present.',
    'load_skills(["search"]), search, then upsert_outreach_target_companies({ projectId, mode: "merge", companies }) before ending.',
    'Do not create CRM Company records for the Companies tab.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type FindPeopleSendPromptInput = {
  projectId: string | null;
  icpSpecSummary: string | null;
};

export const buildFindPeopleSendPrompt = (
  input: FindPeopleSendPromptInput,
): string => {
  return [
    `Find target people for this project (projectId=${input.projectId ?? 'none'}) at the companies already on the Companies tab.`,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : 'Use workspace ICP target titles and locations.',
    'load_skills(["search"]), search, then upsert_outreach_target_people({ projectId, mode: "merge", people }) before ending.',
    'Do not create enrollment records until I confirm Add to CRM / Enroll.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type RegenerateIcpSendPromptInput = {
  workspaceCompany: OutreachWorkspaceCompany;
  currentIcpSpec: string | null;
};

export const buildRegenerateIcpSendPrompt = (
  input: RegenerateIcpSendPromptInput,
): string => {
  const company = input.workspaceCompany;

  return [
    `Regenerate only the workspace default ICP for ${company.name}${
      company.domain ? ` (${company.domain})` : ''
    }.`,
    company.industry ? `Industry: ${company.industry}.` : null,
    company.summary ? `Company summary: ${company.summary}` : null,
    'load_skills(["setup"]), then save icpSpec on workspaceProfile with targetTitles and locations only.',
    'Do not write Project.icpSpec unless I ask for a project-specific override.',
  ]
    .filter(Boolean)
    .join('\n');
};
