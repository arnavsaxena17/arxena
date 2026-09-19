import { workflowActionSchema } from 'twenty-shared/workflow';

import {
  buildCandidateSequencerGraph,
  inferOutreachSequencerGraphOptionsFromSteps,
  OUTREACH_SEQUENCER_STEP_IDS,
  OUTREACH_WORKFLOW_GRAPH_TEMPLATES,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';

type DatabaseEventTrigger = {
  type: string;
  nextStepIds?: string[];
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

const getTrigger = (
  graph: (typeof OUTREACH_WORKFLOW_GRAPH_TEMPLATES)[number],
) => graph.trigger as DatabaseEventTrigger;

describe('GTM outreach workflow graphs', () => {
  it('seeds four outreach workflow templates', () => {
    expect(OUTREACH_WORKFLOW_GRAPH_TEMPLATES).toHaveLength(4);
  });

  it('keeps upload-profiles on Company Created → ICP People Search', () => {
    const companySearch = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Company Created → ICP People Search',
    );
    const steps = (companySearch?.steps ?? []) as GraphStep[];

    expect(steps.some((step) => step.name === 'Upload profiles')).toBe(true);
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

  it('does not seed a candidate.updated workflow', () => {
    const updatedGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.updated',
    );

    expect(updatedGraphs).toHaveLength(0);
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

  it('does not seed a candidate.created workflow', () => {
    const createdGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.created',
    );

    expect(createdGraphs).toHaveLength(0);
  });

  it('wires Candidate Sequencer qualify go straight to connection note by default', () => {
    const candidateSequencer = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Outreach — Candidate Sequencer',
    );
    const steps = (candidateSequencer?.steps ?? []) as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    expect(byName('Load Candidate')?.nextStepIds).toEqual([
      byName('Fetch LinkedIn profile (qualify)')?.id,
    ]);
    expect(byName('Has company name?')).toBeUndefined();
    expect(byName('Find contacted company sibling')).toBeUndefined();
    expect(byName('Draft connection note (no company)')).toBeUndefined();
    expect(byName('Qualify prospect')).toBeDefined();
    expect(byName('Draft connection note')).toBeDefined();
    expect(branchNext('Qualify go?', 0)).toEqual([
      byName('Draft connection note')?.id,
    ]);

    const qualifyProspect = byName('Qualify prospect') as {
      settings?: {
        input?: { agentId?: string };
        outputSchema?: Record<string, unknown>;
      };
    };

    expect(qualifyProspect.settings?.input?.agentId).toBe(
      '__AGENT_qualify_prospect__',
    );
    expect(
      Object.keys(qualifyProspect.settings?.outputSchema ?? {}).sort(),
    ).toEqual([
      'company_short',
      'first_name',
      'go',
      'honorific',
      'hooks',
      'industry_phrase',
      'likely_systems',
      'matching_problem_statement',
      'reason',
      'referral_source',
      'score',
      'segment',
    ]);

    expect(byName('Load Candidate')?.nextStepIds).not.toContain(
      byName('Send LinkedIn connection')?.id,
    );

    expect(byName('Approve connection note')?.nextStepIds).toEqual([
      byName('Connection not yet sent?')?.id,
    ]);
    expect(byName('Connection not yet sent?')?.type).toBe('IF_ELSE');
    expect(
      (
        byName('Connection not yet sent?')?.settings as {
          input: {
            stepFilters: Array<{ operand: string; stepOutputKey: string }>;
          };
        }
      ).input.stepFilters[0],
    ).toEqual(
      expect.objectContaining({
        operand: 'IS_EMPTY',
        stepOutputKey: expect.stringContaining(
          'outreachAnalytics.connectionSentAt',
        ),
      }),
    );
    expect(
      (
        byName('Connection not yet sent?')?.settings as {
          input: { branches: Array<{ nextStepIds: string[] }> };
        }
      ).input.branches[0]?.nextStepIds,
    ).toEqual([byName('Send LinkedIn connection')?.id]);
  });

  it('skips connection send when company dedupe is on and a sibling is already in outreach', () => {
    const steps = buildCandidateSequencerGraph({
      checkDeduplicationPerCompany: true,
    }).steps as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

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
      byName('Draft connection note (no company)')?.id,
    ]);
    expect(branchNext('Company already contacted?', 0)).toEqual([
      byName('Mark DEFERRED — company already contacted')?.id,
    ]);
    expect(branchNext('Earlier QUEUED sibling?', 0)).toEqual([
      byName('Mark DEFERRED — earlier QUEUED sibling')?.id,
    ]);
    expect(branchNext('Earlier QUEUED sibling?', 1)).toEqual([
      byName('Draft connection note')?.id,
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
  });

  it('merges QUEUED, CONNECTION_ACCEPTED and REPLIED into one candidate.upserted sequencer', () => {
    const merged = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Outreach — Candidate Sequencer',
    );

    expect(merged).toBeDefined();

    const trigger = getTrigger(merged!) as DatabaseEventTrigger & {
      settings: {
        filter?: {
          stepFilters?: Array<{
            type?: string;
            value?: string;
            operand?: string;
            stepOutputKey?: string;
          }>;
        };
      };
    };

    expect(trigger.settings.eventName).toBe('candidate.upserted');
    expect(trigger.settings.fields).toEqual([
      'outreachSequenceStage',
      'candidateFlags',
    ]);

    // Entry-stage allowlist evaluated before a run is created, so the graph never
    // wakes on the stages it stamps itself.
    expect(trigger.settings.filter?.stepFilters).toEqual([
      expect.objectContaining({
        type: 'SELECT',
        operand: 'IS',
        value: JSON.stringify([
          'QUEUED',
          'CONNECTION_ACCEPTED',
          'REPLIED',
          'MEETING_BOOKED',
        ]),
        stepOutputKey: '{{trigger.properties.after.outreachSequenceStage}}',
      }),
      expect.objectContaining({
        type: 'BOOLEAN',
        operand: 'IS',
        value: 'true',
        stepOutputKey:
          '{{trigger.properties.after.candidateFlags.startOutreach}}',
      }),
      expect.objectContaining({
        type: 'BOOLEAN',
        operand: 'IS',
        value: 'false',
        stepOutputKey:
          '{{trigger.properties.after.candidateFlags.stopOutreach}}',
      }),
    ]);

    const steps = (merged?.steps ?? []) as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);

    // Router must be IF_ELSE — a leading FILTER would skip-cascade the whole run.
    const router = byName('Route by outreach stage');

    expect(router?.type).toBe('IF_ELSE');
    expect(trigger.nextStepIds).toEqual([byName('Load workspace member')?.id]);
    expect(byName('Load workspace member')?.nextStepIds).toEqual([router?.id]);
    expect(byName('Load workspace member profile')).toBeUndefined();

    const branches = router?.settings?.input?.branches ?? [];

    expect(branches).toHaveLength(5);
    expect(branches[0]?.nextStepIds).toEqual([byName('Load Candidate')?.id]);
    expect(branches[4]?.filterGroupId).toBeUndefined();
    expect(branches[4]?.nextStepIds).toEqual([]);

    const stageFilters = (
      router?.settings as {
        input: { stepFilters: Array<{ value: string }> };
      }
    ).input.stepFilters;

    expect(stageFilters.map((filter) => filter.value)).toEqual([
      JSON.stringify(['QUEUED']),
      JSON.stringify(['CONNECTION_ACCEPTED']),
      JSON.stringify(['REPLIED']),
      JSON.stringify(['MEETING_BOOKED']),
    ]);

    // Single hoisted member step — no-company path only exists when dedupe is on.
    expect(byName('Load workspace member (no company)')).toBeUndefined();
    expect(
      byName('Load workspace member profile (no company)'),
    ).toBeUndefined();
    expect(
      steps.filter((step) => step.name === 'Load workspace member'),
    ).toHaveLength(1);

    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    expect(byName('Has company name?')).toBeUndefined();
    expect(byName('Qualify prospect')?.nextStepIds).toEqual([
      byName('Stamp prospect enrichment')?.id,
    ]);
    expect(byName('Stamp prospect enrichment')?.nextStepIds).toEqual([
      byName('Qualify go?')?.id,
    ]);
    expect(branchNext('Qualify go?', 0)).toEqual([
      byName('Draft connection note')?.id,
    ]);

    // All bodies present, and no duplicate step ids across branches.
    expect(byName('Send LinkedIn connection')).toBeDefined();
    expect(byName('Qualify prospect')).toBeDefined();
    expect(byName('Draft connection note')).toBeDefined();
    expect(byName('Draft first LinkedIn message')).toBeDefined();
    expect(byName('Get calendar availability (opener)')).toBeDefined();
    expect(byName('Fetch LinkedIn messages')?.nextStepIds).toEqual([
      byName('Prior inbound reply in history?')?.id,
    ]);
    expect(byName('Prior inbound reply in history?')?.type).toBe('IF_ELSE');
    expect(
      (
        byName('Prior inbound reply in history?')?.settings as {
          input: {
            stepFilters: Array<{
              type: string;
              value: string;
              stepOutputKey: string;
            }>;
            branches: Array<{ nextStepIds: string[] }>;
          };
        }
      ).input,
    ).toEqual(
      expect.objectContaining({
        stepFilters: [
          expect.objectContaining({
            type: 'BOOLEAN',
            value: 'true',
            stepOutputKey: expect.stringContaining('.hasInboundReply}}'),
          }),
        ],
        branches: [
          expect.objectContaining({
            nextStepIds: [
              byName('Mark REPLIED — prior inbound in history')?.id,
            ],
          }),
          expect.objectContaining({
            nextStepIds: [byName('Fetch LinkedIn profile')?.id],
          }),
        ],
      }),
    );
    expect(
      byName('Mark REPLIED — prior inbound in history')?.nextStepIds ?? [],
    ).toEqual([]);
    expect(byName('Draft sales reply')).toBeDefined();
    expect(byName('Stamp preferred channel')).toBeUndefined();
    expect(byName('Persist prospect email')).toBeUndefined();
    expect(byName('Create referred candidate')?.type).toBe('AI_AGENT');
    expect(byName('Mark MEETING_BOOKED')?.type).toBe('AI_AGENT');
    expect(byName('Mark WAITING_REPLY')?.type).toBe('AI_AGENT');
    expect(byName('Draft meeting reminder')).toBeDefined();
    expect(byName('Mark MEETING_BOOKED')).toBeDefined();

    expect(byName('Validate inbound signals')?.nextStepIds).toEqual([
      byName('Draft sales reply')?.id,
    ]);

    const draftSalesReply = byName('Draft sales reply') as {
      settings?: {
        input?: { prompt?: string; agentId?: string };
        outputSchema?: Record<string, unknown>;
      };
    };

    expect(draftSalesReply.settings?.input?.agentId).toBe('__AGENT_reply__');
    expect(draftSalesReply.settings?.input?.prompt).toContain(
      'CANDIDATE TOOL CALLS',
    );
    expect(draftSalesReply.settings?.input?.prompt).toContain(
      'update_one_person',
    );
    expect(
      Object.keys(draftSalesReply.settings?.outputSchema ?? {}).sort(),
    ).toEqual([
      'emailBody',
      'emailSubject',
      'message',
      'referralCandidateId',
      'referralMessage',
    ]);

    const qualifyProspect = byName('Qualify prospect') as {
      settings?: {
        input?: { agentId?: string };
        outputSchema?: Record<string, unknown>;
      };
    };

    expect(qualifyProspect.settings?.input?.agentId).toBe(
      '__AGENT_qualify_prospect__',
    );
    expect(
      Object.keys(qualifyProspect.settings?.outputSchema ?? {}).sort(),
    ).toEqual([
      'company_short',
      'first_name',
      'go',
      'honorific',
      'hooks',
      'industry_phrase',
      'likely_systems',
      'matching_problem_statement',
      'reason',
      'referral_source',
      'score',
      'segment',
    ]);
    expect(
      qualifyProspect.settings?.outputSchema?.referralName,
    ).toBeUndefined();
    expect(
      qualifyProspect.settings?.outputSchema?.prospectEmail,
    ).toBeUndefined();

    const stepIds = steps.map((step) => step.id);

    expect(new Set(stepIds).size).toBe(stepIds.length);

    // The old FILTER-first gate must not survive the merge.
    expect(byName('Only QUEUED candidates')).toBeUndefined();
  });

  it('only seeds Candidate Sequencer on candidate.upserted', () => {
    const names = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.map((graph) => graph.name);

    expect(names).not.toContain('Outreach — Per Enrolled Candidate');
    expect(names).not.toContain('Outreach — Enrolled Person Updated');

    const upsertedGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) => getTrigger(graph).settings?.eventName === 'candidate.upserted',
    );

    expect(upsertedGraphs).toHaveLength(1);
    expect(upsertedGraphs[0].name).toBe('Outreach — Candidate Sequencer');
  });

  it('only reads keys that the referenced agent or logic function declares', () => {
    const collectTemplates = (value: unknown, found: string[]): string[] => {
      if (typeof value === 'string') {
        found.push(...(value.match(/\{\{[^{}]+\}\}/g) ?? []));
      } else if (Array.isArray(value)) {
        for (const item of value) {
          collectTemplates(item, found);
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const item of Object.values(value)) {
          collectTemplates(item, found);
        }
      }

      return found;
    };

    for (const graph of OUTREACH_WORKFLOW_GRAPH_TEMPLATES) {
      const steps = graph.steps as Array<
        GraphStep & { settings?: { outputSchema?: Record<string, unknown> } }
      >;
      // Only steps whose output contract is declared in this file — record
      // steps derive theirs from object metadata at runtime.
      const declaredOutputs = new Map(
        steps
          .filter(
            (step) =>
              step.type === 'AI_AGENT' || step.type === 'LOGIC_FUNCTION',
          )
          .map((step) => [
            step.id,
            new Set(Object.keys(step.settings?.outputSchema ?? {})),
          ]),
      );

      const checkedTemplates: string[] = [];
      const unknownKeyTemplates: string[] = [];

      for (const template of collectTemplates(steps, [])) {
        const [stepId, firstKey] = template.slice(2, -2).split('.');
        const outputKeys = declaredOutputs.get(stepId);

        if (!outputKeys || outputKeys.size === 0) {
          continue;
        }

        checkedTemplates.push(template);

        if (!outputKeys.has(firstKey)) {
          unknownKeyTemplates.push(`${graph.name}: ${template}`);
        }
      }

      expect(unknownKeyTemplates).toEqual([]);

      if (graph.name === 'Outreach — Candidate Sequencer') {
        // Guards the guard: the sequencer reads agent output all over the
        // REPLIED branch, so an empty check here means the walk broke.
        expect(checkedTemplates.length).toBeGreaterThan(10);
      }
    }
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

  it('omits connection draft/approve when LLM connection note is off', () => {
    const graph = buildCandidateSequencerGraph({
      useLlmConnectionNote: false,
    });
    const steps = graph.steps as GraphStep[];
    const stepIds = new Set(steps.map((step) => step.id));

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.draftConnectNote)).toBe(
      false,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.approveConnectNote)).toBe(
      false,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendConnect)).toBe(true);

    const sendConnect = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.sendConnect,
    ) as { settings?: { input?: { message?: string } } };

    expect(sendConnect.settings?.input?.message).toBe('');
  });

  it('omits all FORM approve steps when human-in-the-loop is off', () => {
    const graph = buildCandidateSequencerGraph({ humanInTheLoop: false });
    const steps = graph.steps as GraphStep[];
    const formSteps = steps.filter((step) => step.type === 'FORM');

    expect(formSteps).toHaveLength(0);

    const sendFirst = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.sendFirst,
    ) as { settings?: { input?: { body?: string } } };

    expect(sendFirst.settings?.input?.body).toBe(
      `{{${OUTREACH_SEQUENCER_STEP_IDS.draftFirst}.message}}`,
    );
  });

  it('omits WhatsApp send steps when WhatsApp is disabled', () => {
    const graph = buildCandidateSequencerGraph({ whatsappEnabled: false });
    const stepIds = new Set(
      (graph.steps as GraphStep[]).map((step) => step.id),
    );

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendReplyWhatsapp)).toBe(
      false,
    );
    expect(
      stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu1Whatsapp),
    ).toBe(false);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendReply)).toBe(true);
  });

  it('omits meeting follow-up tree when meeting follow-up is off', () => {
    const graph = buildCandidateSequencerGraph({
      meetingFollowUpEnabled: false,
    });
    const steps = graph.steps as GraphStep[];
    const stepIds = new Set(steps.map((step) => step.id));

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.meetingBookedFind)).toBe(
      false,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.stampMeetingBooked)).toBe(
      false,
    );

    const meetingCreate = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.meetingCreate,
    );

    expect(meetingCreate?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.stampWaiting,
    ]);
  });

  it('includes company dedupe when check deduplication per company is on', () => {
    const graph = buildCandidateSequencerGraph({
      checkDeduplicationPerCompany: true,
    });
    const steps = graph.steps as GraphStep[];
    const stepIds = new Set(steps.map((step) => step.id));
    const byName = (name: string) => steps.find((step) => step.name === name);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.hasCompanyIf)).toBe(true);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.findContacted)).toBe(true);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendConnectNoCompany)).toBe(
      true,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.draftConnectNote)).toBe(
      true,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendConnect)).toBe(true);
    expect(branchNext('Qualify go?', 0)).toEqual([
      byName('Has company name?')?.id,
    ]);
  });

  it('infers graph options from step ids', () => {
    const defaults = buildCandidateSequencerGraph();
    const withDedupe = buildCandidateSequencerGraph({
      checkDeduplicationPerCompany: true,
    });
    const automated = buildCandidateSequencerGraph({
      humanInTheLoop: false,
      whatsappEnabled: false,
      meetingFollowUpEnabled: false,
      useLlmConnectionNote: false,
    });

    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        defaults.steps as GraphStep[],
        defaults.trigger,
      ),
    ).toEqual({
      useLlmConnectionNote: true,
      humanInTheLoop: true,
      whatsappEnabled: true,
      meetingFollowUpEnabled: true,
      checkDeduplicationPerCompany: false,
    });
    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        withDedupe.steps as GraphStep[],
        withDedupe.trigger,
      ).checkDeduplicationPerCompany,
    ).toBe(true);
    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        automated.steps as GraphStep[],
        automated.trigger,
      ),
    ).toEqual({
      useLlmConnectionNote: false,
      humanInTheLoop: false,
      whatsappEnabled: false,
      meetingFollowUpEnabled: false,
      checkDeduplicationPerCompany: false,
    });
  });

  it('always builds automated candidate.upserted trigger gated by candidateFlags.startOutreach', () => {
    const graph = buildCandidateSequencerGraph({});
    const trigger = graph.trigger as {
      type: string;
      settings: {
        eventName?: string;
        fields?: string[];
        filter?: {
          stepFilters?: Array<{
            type?: string;
            value?: string;
            stepOutputKey?: string;
          }>;
        };
      };
    };

    expect(trigger.type).toBe('DATABASE_EVENT');
    expect(trigger.settings.eventName).toBe('candidate.upserted');
    expect(trigger.settings.fields).toEqual([
      'outreachSequenceStage',
      'candidateFlags',
    ]);

    const filterTypes = (trigger.settings.filter?.stepFilters ?? []).map(
      (stepFilter) => stepFilter.type,
    );

    expect(filterTypes).toContain('SELECT');
    expect(filterTypes).toContain('BOOLEAN');
    expect(
      trigger.settings.filter?.stepFilters?.some(
        (stepFilter) =>
          stepFilter.stepOutputKey?.includes('candidateFlags.startOutreach') &&
          stepFilter.value === 'true',
      ),
    ).toBe(true);
    expect(
      trigger.settings.filter?.stepFilters?.some(
        (stepFilter) =>
          stepFilter.stepOutputKey?.includes('candidateFlags.stopOutreach') &&
          stepFilter.value === 'false',
      ),
    ).toBe(true);
  });
});
