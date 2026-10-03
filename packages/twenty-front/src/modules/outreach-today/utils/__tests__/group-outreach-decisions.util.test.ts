import { splitOutreachDecisions } from '@/outreach-today/utils/group-outreach-decisions.util';
import { type OutreachDecisionListItem } from '@/outreach-today/types/outreach-decision.types';

const decision = (
  overrides: Partial<OutreachDecisionListItem> &
    Pick<OutreachDecisionListItem, 'id' | 'kind'>,
): OutreachDecisionListItem => ({
  urgency: overrides.kind === 'REPLY_DRAFT' ? 'NOW' : 'APPROVE',
  status: 'OPEN',
  title: overrides.id,
  recommendation: 'Approve the draft',
  reason: 'Approve / edit first message',
  draftBody: 'Hello',
  stepId: 'step-1',
  projectId: 'project-1',
  candidateId: overrides.id,
  personId: null,
  companyId: null,
  workflowRunId: 'run-1',
  personName: 'Ada',
  personTitle: 'CFO',
  companyName: 'Analytical Engines',
  projectName: 'Harvest',
  ...overrides,
});

describe('splitOutreachDecisions', () => {
  it('keeps replies single and batches drafts by project, kind, and step', () => {
    const { needsYouNow, approveGroups } = splitOutreachDecisions([
      decision({ id: 'reply-1', kind: 'REPLY_DRAFT' }),
      decision({ id: 'draft-1', kind: 'MESSAGE_DRAFT' }),
      decision({ id: 'draft-2', kind: 'MESSAGE_DRAFT' }),
      decision({
        id: 'note-1',
        kind: 'CONNECTION_NOTE',
        reason: 'Approve connection note',
      }),
    ]);

    expect(needsYouNow.map((item) => item.id)).toEqual(['reply-1']);
    expect(approveGroups).toEqual([
      expect.objectContaining({
        key: 'project-1:MESSAGE_DRAFT:Approve / edit first message',
        decisions: [
          expect.objectContaining({ id: 'draft-1' }),
          expect.objectContaining({ id: 'draft-2' }),
        ],
      }),
      expect.objectContaining({
        decisions: [expect.objectContaining({ id: 'note-1' })],
      }),
    ]);
  });
});
