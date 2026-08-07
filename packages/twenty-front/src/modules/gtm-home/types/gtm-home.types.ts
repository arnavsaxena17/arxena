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

export type GtmMainTab =
  | 'companies'
  | 'people'
  | 'workflow'
  | 'market_map';

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

export type GtmMarketSegment = {
  id: string;
  label: string;
  description: string;
  companyCount: number;
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
    'You are editing the GTM Command outreach workflow for this Project run.',
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
    'When enrolling people, upsert shared CRM Company + Candidate with projectsId = this projectId.',
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
  const proposedIcpSummary = input.proposedIcp
    ? JSON.stringify({
        name: input.proposedIcp.name,
        industries: input.proposedIcp.industries,
        employeeRange: input.proposedIcp.employeeRange,
        geos: input.proposedIcp.geos,
        buyerTitles: input.proposedIcp.buyerTitles,
        painSignals: input.proposedIcp.painSignals,
        stdFunctions: input.proposedIcp.stdFunctions ?? [],
        stdGrades: input.proposedIcp.stdGrades ?? [],
      })
    : 'none';

  return [
    'Start GTM Command Workflow A (bootstrap) ICP onboarding in this chat.',
    'Load skill gtm-icp-onboarding first, then interview me with ask_questions about ICP and outreach preferences.',
    'Persist approved preferences on the active GTM Project (icpSpec, icpSegment, outreachSendMode, caps).',
    'Companies on GTM Command stay ephemeral until people are enrolled; then upsert CRM Company + Candidate.projectsId.',
    `projectId: ${input.projectId ?? 'none — create or select a GTM Project first'}`,
    `projectName: ${input.projectName ?? 'none'}`,
    `workspaceCompany: ${input.workspaceCompany.name} (${input.workspaceCompany.domain})`,
    `industry: ${input.workspaceCompany.industry}`,
    `summary: ${input.workspaceCompany.summary}`,
    `size: ${input.workspaceCompany.employeeRange}`,
    `hq: ${input.workspaceCompany.hq}`,
    `proposedIcpDraft: ${proposedIcpSummary}`,
  ].join('\n');
};
