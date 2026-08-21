import { workflowActionSchema } from 'twenty-shared/workflow';

import { GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/gtm-outreach-workflow-graphs';

type DatabaseEventTrigger = {
  type: string;
  settings: { eventName: string; fields?: string[] };
};

type GraphStep = {
  type: string;
  name?: string;
  settings?: { input?: { branches?: Array<{ filterGroupId?: string }>; fieldsToUpdate?: string[] } };
};

const getTrigger = (graph: (typeof GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES)[number]) =>
  graph.trigger as DatabaseEventTrigger;

describe('GTM outreach workflow graphs', () => {
  it('uses a single candidate.updated workflow with field-scoped IF_ELSE routing', () => {
    const updatedGraphs = GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.updated',
    );

    expect(updatedGraphs).toHaveLength(1);
    expect(updatedGraphs[0].name).toBe('GTM Outreach — Candidate Updated');
    expect(getTrigger(updatedGraphs[0]).settings.fields).toEqual([
      'outreachSequenceStage',
    ]);

    const router = (updatedGraphs[0].steps as GraphStep[]).find(
      (step) =>
        step.type === 'IF_ELSE' && step.name === 'Route by outreach stage',
    );

    expect(router).toBeDefined();

    const branches = (
      router?.settings as {
        input: { branches: Array<{ filterGroupId?: string }> };
      }
    ).input.branches;

    expect(branches).toHaveLength(6);
    expect(branches.filter((branch) => !branch.filterGroupId)).toHaveLength(1);
  });

  it('keeps Per Candidate on candidate.created', () => {
    const createdGraphs = GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.created',
    );

    expect(createdGraphs).toHaveLength(1);
    expect(createdGraphs[0].name).toBe('GTM Outreach — Per Candidate');
  });

  it('includes fieldsToUpdate on every UPDATE_RECORD step', () => {
    for (const graph of GTM_OUTREACH_WORKFLOW_GRAPH_TEMPLATES) {
      for (const step of graph.steps as GraphStep[]) {
        if (step.type !== 'UPDATE_RECORD') {
          continue;
        }

        const parsed = workflowActionSchema.safeParse(step);

        expect(parsed.success).toBe(true);
        expect(step.settings?.input?.fieldsToUpdate?.length).toBeGreaterThan(0);
      }
    }
  });
});
