/**
 * LLM-facing intent vocabulary. Internal ToolCategory / MCP / LF names stay unchanged.
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

/** Stable display names for seeded GTM outreach graphs (IDs via list_workflows). */
export const GTM_SEEDED_WORKFLOW_INVENTORY = [
  {
    name: 'GTM Harvest — LinkedIn Companies',
    trigger: 'CRON',
    role: 'Harvest',
  },
  {
    name: 'Company Created → ICP People Search',
    trigger: 'company.created',
    role: 'Enroll-on-company',
  },
  {
    name: 'GTM Outreach — Per Candidate',
    trigger: 'candidate.created',
    role: 'Sequencer B',
  },
  {
    name: 'GTM Outreach — Candidate Updated',
    trigger: 'candidate.updated',
    role: 'Stage updates',
  },
] as const;

export const buildGtmSeededWorkflowInventoryLines = (
  outreachWorkflowId?: string | null,
): string[] => {
  const lines = [
    'Seeded workflows (prefer activate + reuse; resolve ids via list_workflows):',
  ];

  for (const entry of GTM_SEEDED_WORKFLOW_INVENTORY) {
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
