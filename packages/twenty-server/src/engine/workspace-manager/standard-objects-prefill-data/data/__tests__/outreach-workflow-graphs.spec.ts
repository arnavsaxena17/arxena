import { workflowActionSchema } from 'twenty-shared/workflow';

import { OUTREACH_WORKFLOW_GRAPH_TEMPLATES } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';

type DatabaseEventTrigger = {
  type: string;
  settings: { eventName: string; fields?: string[] };
};

type GraphStep = {
  id?: string;
  type: string;
  name?: string;
  nextStepIds?: string[];
  settings?: {
    input?: {
      branches?: Array<{ filterGroupId?: string; nextStepIds?: string[] }>;
      fieldsToUpdate?: string[];
      filter?: {
        recordFilters?: Array<{
          operand?: string;
          type?: string;
          label?: string;
        }>;
      };
    };
  };
};

const getTrigger = (graph: (typeof OUTREACH_WORKFLOW_GRAPH_TEMPLATES)[number]) =>
  graph.trigger as DatabaseEventTrigger;

describe('GTM outreach workflow graphs', () => {
  it('seeds five outreach workflow templates', () => {
    expect(OUTREACH_WORKFLOW_GRAPH_TEMPLATES).toHaveLength(5);
  });

  it('keeps upload-profiles on Company Created → ICP People Search', () => {
    const companySearch = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Company Created → ICP People Search',
    );
    const steps = (companySearch?.steps ?? []) as GraphStep[];

    expect(
      steps.some((step) => step.name === 'Upload profiles'),
    ).toBe(true);
  });

  it('seeds Fetch & Save as a manual upload-profiles workflow', () => {
    const fetchAndSave = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Outreach — Fetch & Save People Profiles',
    );

    expect(fetchAndSave).toBeDefined();
    expect((fetchAndSave?.trigger as { type: string }).type).toBe('MANUAL');

    const steps = (fetchAndSave?.steps ?? []) as GraphStep[];

    expect(steps).toHaveLength(1);
    expect(steps[0]?.name).toBe('Fetch & Save People Profiles');
    expect(steps[0]?.type).toBe('LOGIC_FUNCTION');
  });

  it('uses a single candidate.updated workflow with field-scoped IF_ELSE routing', () => {
    const updatedGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.updated',
    );

    expect(updatedGraphs).toHaveLength(1);
    expect(updatedGraphs[0].name).toBe('Outreach — Enrolled Person Updated');
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

    expect(branches).toHaveLength(3);
    expect(branches.filter((branch) => !branch.filterGroupId)).toHaveLength(1);

    const stepFilters = (
      router?.settings as {
        input: {
          stepFilters: Array<{
            type: string;
            value: string;
            fieldMetadataId?: string;
          }>;
        };
      }
    ).input.stepFilters;

    expect(stepFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SELECT',
          value: JSON.stringify(['CONNECTION_ACCEPTED']),
          fieldMetadataId: expect.stringContaining('outreachSequenceStage'),
        }),
        expect.objectContaining({
          type: 'SELECT',
          value: JSON.stringify(['REPLIED']),
        }),
      ]),
    );
    expect(stepFilters).toHaveLength(2);
    expect(stepFilters).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: JSON.stringify(['NEGOTIATING']),
        }),
      ]),
    );

    const updatedSteps = updatedGraphs[0].steps as GraphStep[];
    const byName = (name: string) =>
      updatedSteps.find((step) => step.name === name);

    expect(byName('Draft sales reply')).toBeDefined();
    expect(byName('Mark WAITING_REPLY')).toBeDefined();
    expect(byName('Wait 3 days for inbound reply')).toBeDefined();
    expect(byName('Mark FAILED_NO_REPLY')).toBeDefined();
    expect(byName('Draft negotiating reply')).toBeUndefined();
    expect(byName('Draft deferral ack')).toBeUndefined();
  });

  it('keeps harvest Search LinkedIn companies query and keywords blank', () => {
    const harvest = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Harvest — LinkedIn Companies',
    );

    const search = (
      harvest?.steps as Array<{
        name?: string;
        settings?: {
          input?: {
            logicFunctionInput?: { query?: string; keywords?: string };
          };
        };
      }>
    ).find((step) => step.name === 'Search LinkedIn companies');

    expect(search?.settings?.input?.logicFunctionInput?.query).toBe('');
    expect(search?.settings?.input?.logicFunctionInput?.keywords).toBe('');
  });

  it('keeps Per Candidate on candidate.created', () => {
    const createdGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.created',
    );

    expect(createdGraphs).toHaveLength(1);
    expect(createdGraphs[0].name).toBe('Outreach — Per Enrolled Candidate');
  });

  it('skips Per Candidate connection send when another person at the company is already in outreach', () => {
    const perCandidate = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Outreach — Per Enrolled Candidate',
    );
    const steps = (perCandidate?.steps ?? []) as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    expect(byName('Load Candidate')?.nextStepIds).toEqual([
      byName('Has company name?')?.id,
    ]);
    expect(byName('Has company name?')).toBeDefined();
    expect(byName('Find contacted company sibling')).toBeDefined();
    expect(byName('Company already contacted?')).toBeDefined();
    expect(byName('Find earlier QUEUED sibling')).toBeDefined();
    expect(byName('Earlier QUEUED sibling?')).toBeDefined();
    expect(
      byName('Mark DEFERRED — company already contacted')?.settings?.input
        ?.fieldsToUpdate,
    ).toEqual(['outreachSequenceStage']);
    expect(
      byName('Mark DEFERRED — earlier QUEUED sibling')?.settings?.input
        ?.fieldsToUpdate,
    ).toEqual(['outreachSequenceStage']);

    // IF_ELSE branches must not share join step ids (skip cascade bug).
    expect(branchNext('Has company name?', 0)).toEqual([
      byName('Find contacted company sibling')?.id,
    ]);
    expect(branchNext('Has company name?', 1)).toEqual([
      byName('Load workspace member (no company)')?.id,
    ]);
    expect(branchNext('Company already contacted?', 0)).toEqual([
      byName('Mark DEFERRED — company already contacted')?.id,
    ]);
    expect(branchNext('Earlier QUEUED sibling?', 0)).toEqual([
      byName('Mark DEFERRED — earlier QUEUED sibling')?.id,
    ]);
    expect(branchNext('Earlier QUEUED sibling?', 1)).toEqual([
      byName('Load workspace member')?.id,
    ]);
    expect(branchNext('Has company name?', 1)[0]).not.toEqual(
      branchNext('Earlier QUEUED sibling?', 1)[0],
    );
    expect(branchNext('Company already contacted?', 0)[0]).not.toEqual(
      branchNext('Earlier QUEUED sibling?', 0)[0],
    );

    const contactedFilters =
      byName('Find contacted company sibling')?.settings?.input?.filter
        ?.recordFilters ?? [];

    expect(contactedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TEXT',
          operand: 'CONTAINS',
          label: 'Job Company Name',
        }),
        expect.objectContaining({
          type: 'UUID',
          operand: 'IS',
          label: 'Project',
        }),
        expect.objectContaining({
          type: 'UUID',
          operand: 'IS_NOT',
          label: 'Id',
        }),
        expect.objectContaining({
          type: 'SELECT',
          operand: 'IS',
          label: 'Outreach Sequence Stage',
        }),
      ]),
    );

    const earlierFilters =
      byName('Find earlier QUEUED sibling')?.settings?.input?.filter
        ?.recordFilters ?? [];

    expect(earlierFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'DATE_TIME',
          operand: 'IS_BEFORE',
          label: 'Creation date',
        }),
        expect.objectContaining({
          type: 'SELECT',
          operand: 'IS',
          label: 'Outreach Sequence Stage',
        }),
      ]),
    );

    expect(byName('Load Candidate')?.nextStepIds).not.toContain(
      byName('Send LinkedIn connection')?.id,
    );
  });

  it('includes fieldsToUpdate on every UPDATE_RECORD step', () => {
    for (const graph of OUTREACH_WORKFLOW_GRAPH_TEMPLATES) {
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
