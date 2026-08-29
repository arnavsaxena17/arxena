import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

/**
 * LLM-facing intent vocabulary. Internal ToolCategory / MCP / LF names stay unchanged.
 *
 * Neutral CRM copy: Outreach (not GTM); Your company; Target titles (JSON key
 * buyerTitles); people / enrolled people; create_candidate = enrollment record.
 */
export const CHAT_INTENT_SKILLS = {
  setup: 'setup',
  search: 'search',
  outreach: 'outreach',
  crm: 'data-manipulation',
  workflowBuilding: 'workflow-building',
  dashboardBuilding: 'dashboard-building',
} as const;

export type ChatIntentSkillName =
  (typeof CHAT_INTENT_SKILLS)[keyof typeof CHAT_INTENT_SKILLS];

/** Stable display names for seeded outreach graphs (IDs via list_workflows). */
export const SEEDED_OUTREACH_WORKFLOW_INVENTORY = [
  {
    name: SEEDED_OUTREACH_WORKFLOW.harvest.name,
    trigger: SEEDED_OUTREACH_WORKFLOW.harvest.trigger,
    role: SEEDED_OUTREACH_WORKFLOW.harvest.role,
  },
  {
    name: SEEDED_OUTREACH_WORKFLOW.companySearch.name,
    trigger: SEEDED_OUTREACH_WORKFLOW.companySearch.trigger,
    role: SEEDED_OUTREACH_WORKFLOW.companySearch.role,
  },
  {
    name: SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
    trigger: SEEDED_OUTREACH_WORKFLOW.perCandidate.trigger,
    role: SEEDED_OUTREACH_WORKFLOW.perCandidate.role,
  },
  {
    name: SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
    trigger: SEEDED_OUTREACH_WORKFLOW.candidateUpdated.trigger,
    role: SEEDED_OUTREACH_WORKFLOW.candidateUpdated.role,
  },
] as const;

export const buildSeededOutreachWorkflowInventoryLines = (
  outreachWorkflowId?: string | null,
): string[] => {
  const lines = [
    'Seeded workflows (prefer activate + reuse; resolve ids via list_workflows):',
  ];

  for (const entry of SEEDED_OUTREACH_WORKFLOW_INVENTORY) {
    const isPerCandidate = entry.role === 'Sequencer B';
    const bound =
      isPerCandidate && outreachWorkflowId
        ? ` [bound: outreachWorkflowId=${outreachWorkflowId}]`
        : '';

    lines.push(
      `- ${entry.name} (${entry.trigger}) — ${entry.role}${bound}`,
    );
  }

  return lines;
};
