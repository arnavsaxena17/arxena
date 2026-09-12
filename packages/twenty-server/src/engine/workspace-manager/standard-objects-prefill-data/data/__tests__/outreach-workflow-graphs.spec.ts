import { workflowActionSchema } from 'twenty-shared/workflow';

import { OUTREACH_WORKFLOW_GRAPH_TEMPLATES } from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';

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
  it('seeds six outreach workflow templates', () => {
    expect(OUTREACH_WORKFLOW_GRAPH_TEMPLATES).toHaveLength(6);
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

    expect(branches).toHaveLength(4);
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
        expect.objectContaining({
          type: 'SELECT',
          value: JSON.stringify(['MEETING_BOOKED']),
        }),
      ]),
    );
    expect(stepFilters).toHaveLength(3);
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

    expect(byName('Extract inbound signals')).toBeDefined();
    expect(byName('Validate inbound signals')).toBeDefined();
    expect(byName('Draft sales reply')).toBeDefined();
    expect(byName('Skip send if #DONTRESPOND#')).toBeDefined();
    expect(byName('Mark WAITING_REPLY')).toBeDefined();
    expect(byName('Wait 5 days after our reply')).toBeDefined();
    expect(byName('Draft post-reply follow-up 1')).toBeDefined();
    expect(byName('Draft post-reply follow-up 2')).toBeDefined();
    expect(byName('Wait 7 days before post-reply FU2')).toBeDefined();
    expect(byName('Wait 7 days before parking post-reply')).toBeDefined();
    expect(byName('Mark FAILED_NO_REPLY')).toBeDefined();
    expect(byName('Mark FAILED_NO_REPLY (opt-out)')).toBeDefined();
    expect(byName('Draft negotiating reply')).toBeUndefined();
    expect(byName('Draft deferral ack')).toBeUndefined();

    const draftReply = updatedSteps.find(
      (step) => step.name === 'Draft sales reply',
    ) as {
      settings?: {
        input?: { prompt?: string };
        outputSchema?: Record<string, { label?: string }>;
      };
    };

    expect(draftReply.settings?.input?.prompt).toContain('.text}}');
    expect(draftReply.settings?.input?.prompt).not.toContain(
      '.first.message}}',
    );

    // The drafter writes copy only. Times, channel and contacts are decided by
    // the extract step and grounded by the validate step.
    expect(Object.keys(draftReply.settings?.outputSchema ?? {}).sort()).toEqual(
      ['emailBody', 'emailSubject', 'message', 'referralMessage'],
    );

    const extractSignals = byName('Extract inbound signals') as {
      type: string;
      settings?: { outputSchema?: Record<string, unknown> };
    };
    const validateSignals = byName('Validate inbound signals') as {
      type: string;
      settings?: { outputSchema?: Record<string, unknown> };
    };

    expect(extractSignals.type).toBe('AI_AGENT');
    expect(validateSignals.type).toBe('LOGIC_FUNCTION');

    // A slot index is checkable; a free-text ISO date is not.
    expect(
      extractSignals.settings?.outputSchema?.acceptedSlotIndex,
    ).toBeDefined();
    expect(extractSignals.settings?.outputSchema?.startsAt).toBeUndefined();
    expect(validateSignals.settings?.outputSchema?.startsAt).toBeDefined();
    expect(validateSignals.settings?.outputSchema?.endsAt).toBeDefined();
    expect(validateSignals.settings?.outputSchema?.replyChannel).toBeDefined();

    expect(byName('Get calendar availability')?.nextStepIds).toEqual([
      byName('Extract inbound signals')?.id,
    ]);
    expect(byName('Extract inbound signals')?.nextStepIds).toEqual([
      byName('Validate inbound signals')?.id,
    ]);
    expect(byName('Validate inbound signals')?.nextStepIds).toEqual([
      byName('Stamp preferred channel?')?.id,
      byName('Persist prospect email?')?.id,
      byName('Draft sales reply')?.id,
    ]);
    expect(byName('Stamp preferred channel')).toBeDefined();
    expect(byName('Mark MEETING_BOOKED')).toBeDefined();
    expect(byName('Draft meeting reminder')).toBeDefined();
    expect(byName('Create calendar invite')?.nextStepIds).toEqual([
      byName('Mark MEETING_BOOKED')?.id,
    ]);

    const approveReply = updatedSteps.find(
      (step) => step.name === 'Approve / edit reply',
    ) as {
      settings?: {
        input?: Array<{ name?: string; value?: string }>;
        notifyOnPending?: { detailsTemplate?: string };
      };
    };
    const formFields = (approveReply.settings?.input ?? []).map(
      (field) => field.name,
    );

    // WhatsApp Flow only approves send + message text; classification stays
    // off the form and is read from validate / draft steps.
    expect(formFields.sort()).toEqual(['approve', 'editedBody']);
    expect(
      approveReply.settings?.input?.find((field) => field.name === 'editedBody')
        ?.value,
    ).toBe(`{{${byName('Draft sales reply')?.id}.message}}`);

    const validateId = byName('Validate inbound signals')?.id;
    const draftId = byName('Draft sales reply')?.id;
    const detailsTemplate =
      approveReply.settings?.notifyOnPending?.detailsTemplate ?? '';

    expect(detailsTemplate).toContain(`{{${validateId}.replyChannel}}`);
    expect(detailsTemplate).toContain(`{{${validateId}.startsAt}}`);

    const routeChannel = byName('Reply on last inbound channel');
    const routeFilters = (
      routeChannel?.settings as {
        input?: {
          stepFilters?: Array<{ stepOutputKey?: string }>;
        };
      }
    )?.input?.stepFilters;

    expect(routeFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stepOutputKey: `{{${validateId}.replyChannel}}`,
        }),
      ]),
    );

    expect(
      (
        byName('Send details by email?')?.settings as {
          input?: { stepFilters?: Array<{ stepOutputKey?: string }> };
        }
      )?.input?.stepFilters?.[0]?.stepOutputKey,
    ).toBe(`{{${validateId}.prospectEmail}}`);

    expect(
      (
        byName('Meeting time filled?')?.settings as {
          input?: { stepFilters?: Array<{ stepOutputKey?: string }> };
        }
      )?.input?.stepFilters?.[0]?.stepOutputKey,
    ).toBe(`{{${validateId}.startsAt}}`);

    const sendProspectEmail = byName('Email details to prospect') as {
      settings?: {
        input?: {
          recipients?: { to?: string };
          subject?: string;
          body?: string;
        };
      };
    };

    expect(sendProspectEmail.settings?.input?.recipients?.to).toBe(
      `{{${validateId}.prospectEmail}}`,
    );
    expect(sendProspectEmail.settings?.input?.subject).toBe(
      `{{${draftId}.emailSubject}}`,
    );
    expect(sendProspectEmail.settings?.input?.body).toBe(
      `{{${draftId}.emailBody}}`,
    );

    const skipSend = byName('Skip send if #DONTRESPOND#');
    const skipFilters = (
      skipSend?.settings as {
        input?: {
          stepFilters?: Array<{ operand?: string; value?: string }>;
        };
      }
    )?.input?.stepFilters;

    expect(skipFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operand: 'CONTAINS',
          value: '#DONTRESPOND#',
        }),
      ]),
    );

    expect(skipSend?.settings?.input?.branches?.[0]?.nextStepIds).toEqual([
      byName('Mark FAILED_NO_REPLY (opt-out)')?.id,
    ]);
    expect(skipSend?.settings?.input?.branches?.[1]?.nextStepIds).toEqual([
      byName('Reply on last inbound channel')?.id,
    ]);

    expect(byName('Send reply on LinkedIn')).toBeDefined();
    expect(byName('Send reply by email')).toBeDefined();
    expect(byName('Send reply on WhatsApp')).toBeDefined();

    const findChats = updatedSteps.find(
      (step) =>
        step.name === 'Load inbound WhatsApp / LinkedIn / email messages',
    ) as {
      settings?: {
        input?: {
          orderBy?: { gqlOperationOrderBy?: Array<Record<string, string>> };
        };
      };
    };

    expect(findChats.settings?.input?.orderBy?.gqlOperationOrderBy).toEqual([
      { createdAt: 'DescNullsLast' },
    ]);
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
      byName('Load workspace member')?.id,
    ]);
    expect(byName('Has company name?')).toBeDefined();
    expect(byName('Find contacted company sibling')).toBeDefined();
    expect(byName('Company already contacted?')).toBeDefined();
    expect(byName('Find earlier QUEUED sibling')).toBeDefined();
    expect(byName('Earlier QUEUED sibling?')).toBeDefined();
    expect(byName('Qualify prospect')).toBeDefined();
    expect(byName('Draft connection note')).toBeDefined();
    expect(
      byName('Mark DEFERRED — company already contacted')?.settings?.input
        ?.fieldsToUpdate,
    ).toEqual(['outreachSequenceStage']);
    expect(
      byName('Mark DEFERRED — earlier QUEUED sibling')?.settings?.input
        ?.fieldsToUpdate,
    ).toEqual(['outreachSequenceStage']);

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

    expect(byName('Load Candidate')?.nextStepIds).not.toContain(
      byName('Send LinkedIn connection')?.id,
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
    expect(trigger.settings.fields).toEqual(['outreachSequenceStage']);

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

    // Single hoisted member step — the duplicate "no company" load is gone.
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

    expect(branchNext('Has company name?', 1)).toEqual([
      byName('Draft connection note (no company)')?.id,
    ]);
    expect(branchNext('Earlier QUEUED sibling?', 1)).toEqual([
      byName('Draft connection note')?.id,
    ]);
    expect(branchNext('Qualify go?', 0)).toEqual([
      byName('Stamp prospect enrichment')?.id,
    ]);

    // All bodies present, and no duplicate step ids across branches.
    expect(byName('Send LinkedIn connection')).toBeDefined();
    expect(byName('Qualify prospect')).toBeDefined();
    expect(byName('Draft connection note')).toBeDefined();
    expect(byName('Draft first LinkedIn message')).toBeDefined();
    expect(byName('Get calendar availability (opener)')).toBeDefined();
    expect(byName('Draft sales reply')).toBeDefined();
    expect(byName('Stamp preferred channel')).toBeDefined();
    expect(byName('Draft meeting reminder')).toBeDefined();
    expect(byName('Mark MEETING_BOOKED')).toBeDefined();

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

  it('leaves the two original sequencer graphs on their own triggers', () => {
    const names = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.map((graph) => graph.name);

    expect(names).toContain('Outreach — Per Enrolled Candidate');
    expect(names).toContain('Outreach — Enrolled Person Updated');

    const upsertedGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) => getTrigger(graph).settings?.eventName === 'candidate.upserted',
    );

    expect(upsertedGraphs).toHaveLength(1);
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
});
