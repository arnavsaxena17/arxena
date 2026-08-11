export type GtmOutreachStage =
  | 'queued'
  | 'needs_connection'
  | 'connection_sent'
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

export type GtmIcpSet = {
  name: string;
  industries: string[];
  employeeRange: string;
  geos: string[];
  buyerTitles: string[];
  painSignals: string[];
  stdFunctions?: string[];
  stdGrades?: string[];
};

export type GtmWorkspaceProfileRecord = {
  id: string;
  name?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  industry?: string | null;
  summary?: string | null;
  employeeRange?: string | null;
  hq?: string | null;
  icpSegment?: string | null;
  icpSpec?: string | null;
  icpBlurb?: string | null;
  companySearchBlurb?: string | null;
  peopleSearchBlurb?: string | null;
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
  // Mirrors Project.id for new runs; may be a legacy slug on older seeds.
  gtmRunKey: string | null;
  outreachWorkflowId: string | null;
  outreachSendMode: GtmOutreachSendMode;
  maxPersonasPerCompany: number;
  inMailFallbackEnabled: boolean;
  sendTimezone: string;
  sendWindowStart: string;
  sendWindowEnd: string;
  whatsappConnected: boolean;
  icpSegment: string | null;
  icpSpec: string | null;
  icpBlurb: string | null;
  companySearchBlurb: string | null;
  peopleSearchBlurb: string | null;
  isIcpRunOverride: boolean;
  isIcpBlurbRunOverride: boolean;
  isCompanySearchBlurbRunOverride: boolean;
  isPeopleSearchBlurbRunOverride: boolean;
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
    'You are helping with GTM Command for this Project run.',
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
    'When the user asks to find/fetch/search people (MD/CEO, buyers, etc.) for this GTM run: load_skills(["search-people","linkedin-search"]) as needed, search, then upsert_gtm_target_people({ projectId, mode: "merge", people }) before ending the turn.',
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
  proposedIcp?: GtmIcpSet | null;
};

export const buildGtmIcpOnboardingKickoffPrompt = (
  input: GtmIcpOnboardingKickoffInput,
): string => {
  const company = input.workspaceCompany;
  const projectLabel = input.projectName
    ? `"${input.projectName}"`
    : input.projectId
      ? `this GTM run`
      : 'a new GTM run';

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
        `I already have a rough ICP draft called "${proposedIcp.name}" — feel free to challenge or refine it:`,
        proposedIcp.industries.length > 0
          ? `- Industries: ${proposedIcp.industries.join(', ')}`
          : null,
        proposedIcp.employeeRange
          ? `- Company size: ${proposedIcp.employeeRange}`
          : null,
        proposedIcp.geos.length > 0
          ? `- Geos: ${proposedIcp.geos.join(', ')}`
          : null,
        proposedIcp.buyerTitles.length > 0
          ? `- Buyer titles: ${proposedIcp.buyerTitles.join(', ')}`
          : null,
        proposedIcp.painSignals.length > 0
          ? `- Pain signals: ${proposedIcp.painSignals.join('; ')}`
          : null,
        (proposedIcp.stdFunctions?.length ?? 0) > 0
          ? `- Functions: ${(proposedIcp.stdFunctions ?? []).join(', ')}`
          : null,
        (proposedIcp.stdGrades?.length ?? 0) > 0
          ? `- Grades: ${(proposedIcp.stdGrades ?? []).join(', ')}`
          : null,
      ].filter(Boolean)
    : [];

  return [
    `Hey — help me set up ICP and outreach preferences for ${projectLabel}.`,
    companyBlurb +
      '. Walk me through who we should sell to, buyer personas, send mode (approval vs auto), and caps — ask questions as we go.',
    'When we agree, save the default ICP (icpSpec + icpBlurb) + company/people search blurbs on the workspace GTM Workspace Profile (not only this Project). Only write Project.icpSpec if I ask for a run-specific override.',
    ...draftLines,
  ].join('\n');
};

export type GtmFindCompaniesSendPromptInput = {
  projectId: string | null;
  companySearchBlurb: string | null;
  icpBlurb: string | null;
  icpSpecSummary: string | null;
};

export const buildGtmFindCompaniesSendPrompt = (
  input: GtmFindCompaniesSendPromptInput,
): string => {
  return [
    `Find target companies for this GTM run (projectId=${input.projectId ?? 'none'}).`,
    input.companySearchBlurb ??
      'Use the effective ICP for this workspace / run to find high-fit accounts.',
    input.icpBlurb ? `ICP blurb: ${input.icpBlurb}` : null,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : null,
    'load_skills(["search-companies"]), search, then upsert_gtm_target_companies({ projectId, mode: "merge", companies }) before ending.',
    'Do not create CRM Company records for the Companies tab.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type GtmFindPeopleSendPromptInput = {
  projectId: string | null;
  peopleSearchBlurb: string | null;
  icpBlurb: string | null;
  icpSpecSummary: string | null;
};

export const buildGtmFindPeopleSendPrompt = (
  input: GtmFindPeopleSendPromptInput,
): string => {
  return [
    `Find target people for this GTM run (projectId=${input.projectId ?? 'none'}) at the companies already on the Companies tab.`,
    input.peopleSearchBlurb ??
      'Use the effective ICP buyer titles / functions for this workspace / run.',
    input.icpBlurb ? `ICP blurb: ${input.icpBlurb}` : null,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : null,
    'load_skills(["search-people","linkedin-search"]) as needed, search, then upsert_gtm_target_people({ projectId, mode: "merge", people }) before ending.',
    'Do not create CRM Candidates until I confirm Add to CRM / Enroll.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type GtmRegenerateIcpSendPromptInput = {
  workspaceCompany: GtmWorkspaceCompany;
  currentIcpSpec: string | null;
  currentIcpBlurb: string | null;
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
    input.currentIcpSpec
      ? `Current ICP JSON (replace with an improved draft): ${input.currentIcpSpec}`
      : 'No ICP JSON yet — draft one from the seller company.',
    input.currentIcpBlurb
      ? `Current icpBlurb (replace with an improved NL definition): ${input.currentIcpBlurb}`
      : 'No icpBlurb yet — write a 2–4 sentence NL definition of who we sell to.',
    'load_skills(["gtm-icp-onboarding"]), then save icpSpec + icpBlurb + icpSegment on gtmWorkspaceProfile (workspace default).',
    'Do NOT change companySearchBlurb or peopleSearchBlurb — those have their own Regenerate actions.',
    'Do not write Project.icpSpec unless I ask for a run-specific override.',
  ]
    .filter(Boolean)
    .join('\n');
};

export type GtmRegenerateSearchBlurbSendPromptInput = {
  kind: 'company' | 'people';
  workspaceCompany: GtmWorkspaceCompany;
  icpBlurb: string | null;
  icpSpecSummary: string | null;
  currentBlurb: string | null;
};

export const buildGtmRegenerateSearchBlurbSendPrompt = (
  input: GtmRegenerateSearchBlurbSendPromptInput,
): string => {
  const fieldName =
    input.kind === 'company' ? 'companySearchBlurb' : 'peopleSearchBlurb';
  const label =
    input.kind === 'company' ? 'company search blurb' : 'people search blurb';

  return [
    `Regenerate only the ${label} on gtmWorkspaceProfile for ${input.workspaceCompany.name}.`,
    input.icpBlurb ? `ICP blurb: ${input.icpBlurb}` : null,
    input.icpSpecSummary
      ? `Effective ICP JSON: ${input.icpSpecSummary}`
      : 'Use the workspace ICP if present; if missing, draft a minimal ICP + icpBlurb first.',
    input.currentBlurb ? `Current ${fieldName}: ${input.currentBlurb}` : null,
    `Write an improved short NL brief to ${fieldName} on gtmWorkspaceProfile. Do not change icpSpec / icpBlurb unless they are empty.`,
    input.kind === 'company'
      ? 'The blurb should be ready to SEND for Find companies (industries, size, geos, ~15–25 accounts).'
      : 'The blurb should be ready to SEND for Find people (buyer titles / functions at companies already on this run).',
  ]
    .filter(Boolean)
    .join('\n');
};
