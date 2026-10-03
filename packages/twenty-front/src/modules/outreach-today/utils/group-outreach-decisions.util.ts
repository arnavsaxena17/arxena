import {
  OUTREACH_DECISION_APPROVE_KINDS,
  OUTREACH_DECISION_NOW_KINDS,
  type OutreachDecisionGroup,
  type OutreachDecisionListItem,
} from '@/outreach-today/types/outreach-decision.types';

const NOW_KIND_SET = new Set<string>(OUTREACH_DECISION_NOW_KINDS);
const APPROVE_KIND_SET = new Set<string>(OUTREACH_DECISION_APPROVE_KINDS);

export const splitOutreachDecisions = (
  decisions: OutreachDecisionListItem[],
): {
  needsYouNow: OutreachDecisionListItem[];
  approveGroups: OutreachDecisionGroup[];
} => {
  const needsYouNow = decisions.filter((decision) =>
    NOW_KIND_SET.has(decision.kind),
  );
  const approveDecisions = decisions.filter((decision) =>
    APPROVE_KIND_SET.has(decision.kind),
  );
  const groups = new Map<string, OutreachDecisionGroup>();

  for (const decision of approveDecisions) {
    const key = `${decision.projectId ?? ''}:${decision.kind}:${decision.reason}`;
    const existing = groups.get(key);

    if (existing) {
      existing.decisions.push(decision);
      continue;
    }

    groups.set(key, {
      key,
      projectName: decision.projectName,
      reason: decision.reason,
      decisions: [decision],
    });
  }

  return {
    needsYouNow,
    approveGroups: [...groups.values()],
  };
};

export const preferredOpenDecision = (
  decisions: OutreachDecisionListItem[],
): OutreachDecisionListItem | null => {
  const now = decisions.find((decision) => decision.urgency === 'NOW');

  return now ?? decisions[0] ?? null;
};
