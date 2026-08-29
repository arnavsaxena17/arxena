export type GtmOutreachStage =
  | 'queued'
  | 'needs_connection'
  | 'connection_sent'
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

export type GtmMainTab = 'setup' | 'companies' | 'people' | 'workflow';

export type GtmOutreachSendMode = 'AUTO' | 'APPROVAL';

export type GtmWorkspaceCompany = {
  name: string;
  domain: string;
  industry: string;
  summary: string;
  employeeRange: string;
  hq: string;
};

/** Structured ICP stored in `icpSpec` JSON (workspaceProfile / Project). */
export type GtmIcpSpec = {
  buyerTitles: string[];
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

export type GtmCompanyRow = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: string;
  segment: string;
  icpFit: string;
  status: string;
};

export type GtmPersonRow = {
  id: string;
  name: string;
  title: string;
  companyId: string;
  companyName: string;
  linkedinUrl: string;
  warmPath: string;
  stage: GtmOutreachStage;
  email: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
  doNotContact?: boolean;
  pendingChannel?: string;
  candidateId?: string;
};

export type GtmProjectOption = {
  id: string;
  name: string;
  icpSegment: string | null;
};

export type GtmProjectSettings = {
  projectId: string | null;
  projectName: string | null;
  gtmRunKey: string | null;
  outreachWorkflowId: string | null;
  outreachSendMode: GtmOutreachSendMode;
  maxPersonasPerCompany: number;
  inMailFallbackEnabled: boolean;
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  whatsappConnected: boolean;
  icpSpec: string | null;
  isIcpProjectOverride: boolean;
};

export type GtmCommandContext = {
  projectId: string | null;
  projectName: string | null;
  gtmRunKey: string | null;
  outreachWorkflowId: string | null;
  outreachSendMode: GtmOutreachSendMode;
  selectedCompanyId: string | null;
  selectedPersonId: string | null;
  selectedCandidateStage: GtmOutreachStage | null;
  icpName: string | null;
  icpSpecSummary: string | null;
  linkedinConnected: boolean;
  gmailConnected: boolean;
  whatsappConnected: boolean;
  phase: string | null;
};

export const buildGtmCommandContextPrompt = (
  context: GtmCommandContext,
): string => {
  return [
    'You are helping with GTM Command for this Project.',
    `projectId: ${context.projectId ?? 'none'}`,
    `projectName: ${context.projectName ?? 'none'}`,
    `gtmRunKey: ${context.gtmRunKey ?? context.projectId ?? 'none'}`,
    `outreachWorkflowId: ${context.outreachWorkflowId ?? 'none'}`,
    `sendMode: ${context.outreachSendMode}`,
    `phase: ${context.phase ?? 'live'}`,
    `selectedCompanyId: ${context.selectedCompanyId ?? 'none'}`,
    `selectedPersonId: ${context.selectedPersonId ?? 'none'}`,
    `selectedCandidateStage: ${context.selectedCandidateStage ?? 'none'}`,
    `icp: ${context.icpName ?? 'none'}`,
    `icpSpec: ${context.icpSpecSummary ?? 'none'}`,
    `channels: LinkedIn=${context.linkedinConnected} Gmail=${context.gmailConnected} WhatsApp=${context.whatsappConnected}`,
    'Target companies on /gtm-home are ephemeral (Redis per projectId), not CRM membership.',
    'When the user asks to find/fetch/add/build target companies: load_skills(["search-companies"]), search, then upsert_gtm_target_companies({ projectId, mode: "merge", companies }) before ending the turn. Do not stop at a chat-only list.',
    'Do NOT create CRM Company records for the Companies tab — only when enrolling people.',
    'Target people on the People tab are ephemeral (Redis per projectId) until the user selects rows and confirms Add to CRM / Enroll.',
    'When the user asks to find/fetch/search people (MD/CEO, buyers, etc.) for this GTM project: load_skills(["search-people","linkedin-search"]) as needed, search, then upsert_gtm_target_people({ projectId, mode: "merge", people }) before ending the turn.',
    'Do NOT create_candidate / create_one_person / create_one_candidate for the People tab. CRM Candidate writes happen only after explicit user confirmation (Add to CRM / Enroll).',
    'When enrolling people (user confirmed), upsert shared CRM Company + Candidate with projectsId = this projectId.',
    'Prefer Candidate+Project execution; Person holds stop/compliance memory.',
    'Respect send windows, daily caps, stop-on-reply, and approval gates when editing steps.',
  ].join('\n');
};

export type GtmIcpOnboardingKickoffInput = {
  workspaceCompany: GtmWorkspaceCompany;
  projectId: string | null;
  projectName: string | null;
  proposedIcp?: GtmIcpSpec | null;
};

export const buildGtmIcpOnboardingKickoffPrompt = (
  input: GtmIcpOnboardingKickoffInput,
): string => {
  const company = input.workspaceCompany;
  const projectLabel = input.projectName
    ? `"${input.projectName}"`
    : input.projectId
      ? `this GTM project`
      : 'a new GTM project';

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
        proposedIcp.buyerTitles.length > 0
          ? `- Buyer titles: ${proposedIcp.buyerTitles.join(', ')}`
          : null,
        proposedIcp.locations.length > 0
          ? `- Locations: ${proposedIcp.locations.join(', ')}`
          : null,
      ].filter(Boolean)
    : [];

  return [
    `Hey — help me set up ICP and outreach preferences for ${projectLabel}.`,
    companyBlurb +
      '. Walk me through who we should sell to (buyer titles and locations), send mode (approval vs auto), and caps — ask questions as we go.',
    'When we agree, save the default ICP as icpSpec JSON on workspaceProfile (buyerTitles + locations only). Only write Project.icpSpec if I ask for a project-specific override.',
    ...draftLines,
  ].join('\n');
};

export type GtmFindCompaniesSendPromptInput = {
  projectId: string | null;
  icpSpecSummary: string | null;
};

export const buildGtmFindCompaniesSendPrompt = (
  input: GtmFindCompaniesSendPromptInput,
): string => {
  return [
    `Find target companies for this GTM project (projectId=${input.projectId ?? 'none'}).`,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : 'Use the workspace ICP buyer titles and locations if present.',
    'load_skills(["search-companies"]), search, then upsert_gtm_target_companies({ projectId, mode: "merge", companies }) before ending.',
    'Do not create CRM Company records for the Companies tab.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type GtmFindPeopleSendPromptInput = {
  projectId: string | null;
  icpSpecSummary: string | null;
};

export const buildGtmFindPeopleSendPrompt = (
  input: GtmFindPeopleSendPromptInput,
): string => {
  return [
    `Find target people for this GTM project (projectId=${input.projectId ?? 'none'}) at the companies already on the Companies tab.`,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : 'Use workspace ICP buyer titles and locations.',
    'load_skills(["search-people","linkedin-search"]) as needed, search, then upsert_gtm_target_people({ projectId, mode: "merge", people }) before ending.',
    'Do not create CRM Candidates until I confirm Add to CRM / Enroll.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type GtmRegenerateIcpSendPromptInput = {
  workspaceCompany: GtmWorkspaceCompany;
  currentIcpSpec: string | null;
};

export const buildGtmRegenerateIcpSendPrompt = (
  input: GtmRegenerateIcpSendPromptInput,
): string => {
  const company = input.workspaceCompany;

  return [
    `Regenerate only the workspace default ICP for ${company.name}${
      company.domain ? ` (${company.domain})` : ''
    }.`,
    company.industry ? `Industry: ${company.industry}.` : null,
    company.summary ? `Company summary: ${company.summary}` : null,
    'load_skills(["gtm-icp-onboarding"]), then save icpSpec on workspaceProfile with buyerTitles and locations only.',
    'Do not write Project.icpSpec unless I ask for a project-specific override.',
  ]
    .filter(Boolean)
    .join('\n');
};
