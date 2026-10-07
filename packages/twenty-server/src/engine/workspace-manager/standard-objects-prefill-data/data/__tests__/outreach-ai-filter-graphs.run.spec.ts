// Workflow-level test of the three seeded "find" graphs.
//
// Runs the REAL seeded graph definitions step by step with the real variable
// resolver (twenty-shared resolveInput) and the real AI filtering action. Only
// the outside world is faked: search / upload logic functions return canned
// data and record the input they were given, and the filter model decides by a
// simple rule. This proves the plumbing (payload -> search -> filter -> save
// only the kept records) without LinkedIn, a model key or a database.
import { resolveInput } from 'twenty-shared/utils';

import {
  type FilterSpec,
  type RecordVerdict,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { AiFilteringWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filtering.workflow-action';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

import { OUTREACH_WORKFLOW_GRAPH_TEMPLATES } from '../outreach-workflow-graphs';

type Step = {
  id: string;
  name: string;
  type: string;
  nextStepIds?: string[];
  settings: { input: Record<string, unknown> };
};

type Graph = {
  trigger: { nextStepIds?: string[] };
  steps: Step[];
};

const clone = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value));

const FIND_COMPANIES_SEARCH = [
  { id: 'c1', name: 'Freshpay', industry: 'Software Development' },
  { id: 'c2', name: 'SaaS Capital', industry: 'Financial Services' },
  { id: 'c3', name: 'Leadloop', industry: 'Software Development' },
];
const FIND_PEOPLE_SEARCH = [
  { id: 'p1', name: 'Asha', title: 'VP Sales' },
  { id: 'p2', name: 'Intern', title: 'Intern' },
];

// Fake model: keep when the record's industry/title looks right.
const decide = (record: Record<string, unknown>): boolean =>
  record.industry === 'Software Development' || record.title === 'VP Sales';

const buildFilterService = (
  mode: 'rule' | 'allFail' = 'rule',
): { service: WorkflowAiFilteringService; modelCalls: jest.Mock } => {
  const modelCalls = jest.fn();
  const run = jest.fn(
    async (
      records: Array<Record<string, unknown> & { id: string }>,
      _spec: FilterSpec,
    ) => {
      modelCalls(records.length);

      const verdicts: RecordVerdict[] = records.map((record) =>
        mode === 'allFail'
          ? {
              id: record.id,
              status: 'failed' as const,
              keep: null,
              answers: {},
              error: 'provider down',
            }
          : {
              id: record.id,
              status: 'answered' as const,
              keep: decide(record),
              answers: { keep: decide(record) },
              reason: decide(record) ? undefined : 'does not fit',
            },
      );

      return {
        verdicts,
        stats: {
          engine: 'openai' as const,
          model: 'fake',
          calls: 1,
          retriedRecords: 0,
          durationMs: 1,
        },
      };
    },
  );
  const service = new WorkflowAiFilteringService(
    { run } as never,
    {} as never,
    { add: jest.fn() } as never,
    { resolveForWorkspace: jest.fn().mockResolvedValue('') } as never,
  );

  return { service, modelCalls };
};

const runGraph = async ({
  graphName,
  payload,
  lfOutputs,
  filterMode,
}: {
  graphName: string;
  payload: Record<string, unknown>;
  lfOutputs: Record<string, object>;
  filterMode?: 'rule' | 'allFail';
}) => {
  const template = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
    (graph) => graph.name === graphName,
  );
  const graph = clone(template) as unknown as Graph;
  const { service, modelCalls } = buildFilterService(filterMode);
  const action = new AiFilteringWorkflowAction(service);
  const context: Record<string, unknown> = { trigger: payload };
  const lfInputs: Record<string, unknown> = {};
  const byId = new Map(graph.steps.map((step) => [step.id, step]));
  let current = graph.trigger.nextStepIds?.[0];
  let filterResult: Record<string, unknown> | undefined;

  while (current) {
    const step = byId.get(current) as Step;

    if (step.type === 'LOGIC_FUNCTION') {
      const { logicFunctionId, logicFunctionInput } = step.settings.input as {
        logicFunctionId: string;
        logicFunctionInput: Record<string, unknown>;
      };
      const name = logicFunctionId.replace(/^__LF_|__$/g, '');

      lfInputs[name] = resolveInput(clone(logicFunctionInput), context);
      context[step.id] = lfOutputs[name];
    } else if (step.type === 'AI_FILTERING') {
      const output = await action.execute({
        currentStepId: step.id,
        steps: [step],
        context,
        runInfo: { workspaceId: 'w', workflowRunId: 'r' },
      } as never);

      if (output.pendingEvent) {
        // Real runs finish through the queue job; do the same work inline.
        const resolved = resolveInput(
          clone(step.settings.input),
          context,
        ) as Parameters<
          WorkflowAiFilteringService['processAndBuildResult']
        >[0]['filter'] & { candidates: Record<string, unknown>[] };

        filterResult = (await service.processAndBuildResult({
          candidates: resolved.candidates,
          filter: resolved,
        })) as unknown as Record<string, unknown>;
      } else {
        filterResult = output.result as Record<string, unknown>;
      }

      context[step.id] = filterResult;
    }

    current = step.nextStepIds?.[0];
  }

  return { lfInputs, filterResult, modelCalls };
};

const PROJECT = '11111111-1111-4111-8111-111111111111';
const COMPANY = '22222222-2222-4222-8222-222222222222';

describe('seeded find graphs, end to end through the variable resolver', () => {
  it('Find companies: payload feeds the search, only fitting companies are upserted', async () => {
    const { lfInputs, filterResult } = await runGraph({
      graphName: 'Find companies',
      payload: {
        projectId: PROJECT,
        limit: 3,
        query: 'B2B SaaS',
        industry: 'software',
      },
      lfOutputs: {
        'search-companies': { companies: FIND_COMPANIES_SEARCH },
        'upsert-companies': { created: 2 },
      },
    });

    expect(lfInputs['search-companies']).toMatchObject({
      projectId: PROJECT,
      limit: 3,
      query: 'B2B SaaS',
      industry: 'software',
    });
    expect(
      (
        lfInputs['upsert-companies'] as { companies: Array<{ id: string }> }
      ).companies.map((company) => company.id),
    ).toEqual(['c1', 'c3']);
    expect(lfInputs['upsert-companies']).toMatchObject({ projectId: PROJECT });
    expect(
      filterResult?.rejected as Array<{ id: string; reason: string }>,
    ).toEqual([expect.objectContaining({ id: 'c2', reason: 'does not fit' })]);
  });

  it.each(['Find people by company', 'Find people by search'])(
    '%s: only kept people reach upload-profiles',
    async (graphName) => {
      const { lfInputs } = await runGraph({
        graphName,
        payload: { projectId: PROJECT, companyId: COMPANY, limit: 10 },
        lfOutputs: {
          'search-people-for-company': { people: FIND_PEOPLE_SEARCH },
          'search-people': { people: FIND_PEOPLE_SEARCH },
          'upload-profiles': { created: 1 },
        },
      });

      expect(
        (
          lfInputs['upload-profiles'] as { people: Array<{ id: string }> }
        ).people.map((person) => person.id),
      ).toEqual(['p1']);
      expect(lfInputs['upload-profiles']).toMatchObject({
        projectId: PROJECT,
        companyId: COMPANY,
      });
    },
  );

  it('an empty search finishes cleanly: no model call, nothing uploaded', async () => {
    const { lfInputs, filterResult, modelCalls } = await runGraph({
      graphName: 'Find companies',
      payload: { projectId: PROJECT },
      lfOutputs: {
        'search-companies': { companies: [] },
        'upsert-companies': { created: 0 },
      },
    });

    expect(modelCalls).not.toHaveBeenCalled();
    expect(filterResult).toMatchObject({ success: true, total: 0, kept: [] });
    expect(
      (lfInputs['upsert-companies'] as { companies: unknown[] }).companies,
    ).toEqual([]);
  });

  it('stops the run when the model answers nothing, instead of rejecting everyone', async () => {
    await expect(
      runGraph({
        graphName: 'Find people by company',
        payload: { projectId: PROJECT, companyId: COMPANY },
        lfOutputs: {
          'search-people-for-company': { people: FIND_PEOPLE_SEARCH },
          'upload-profiles': { created: 1 },
        },
        filterMode: 'allFail',
      }),
    ).rejects.toThrow('no valid answer for any of 2 records');
  });
});
