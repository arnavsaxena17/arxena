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

export type GtmMainTab = 'companies' | 'people' | 'workflow';

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
    company.hq ? `HQ ${company.hq}` : null,
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
    `Hey — help me set up ICP and outreach preferences for ${projectLabel} on GTM Command.`,
    companyBlurb +
      (company.summary ? `. ${company.summary}` : '.') +
      (input.projectId ? ` Project id: ${input.projectId}.` : ''),
    'Walk me through who we should sell to, buyer personas, send mode (approval vs auto), and caps — ask questions as we go, then save what we agree on to this GTM Project.',
    ...draftLines,
  ].join('\n');
};
