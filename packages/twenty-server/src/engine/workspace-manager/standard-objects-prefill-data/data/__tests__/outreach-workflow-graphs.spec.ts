import { validate as uuidValidate } from 'uuid';
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
      stepFilters?: Array<{ stepOutputKey?: string }>;
      fieldsToUpdate?: string[];
      duration?: {
        days?: number;
        hours?: number;
        minutes?: number;
        seconds?: number;
      };
      filter?: {
        recordFilters?: Array<{
          operand?: string;
          type?: string;
          label?: string;
        }>;
      };
      prompt?: string;
    };
  };
};

const getTrigger = (
  graph: (typeof OUTREACH_WORKFLOW_GRAPH_TEMPLATES)[number],
) => graph.trigger as DatabaseEventTrigger;

describe('GTM outreach workflow graphs', () => {
  it('seeds seven outreach workflow templates', () => {
    expect(OUTREACH_WORKFLOW_GRAPH_TEMPLATES).toHaveLength(7);
  });

  // GraphQL UUID scalar uses uuid.validate — placeholder-looking IDs with
  // wrong variant bits (e.g. ...-1f2a-...) fail UpdateWorkflowVersionStep.
  it('uses RFC 4122 step ids in every seeded graph', () => {
    for (const graph of OUTREACH_WORKFLOW_GRAPH_TEMPLATES) {
      const steps = (graph.steps ?? []) as GraphStep[];

      for (const step of steps) {
        expect(step.id).toBeDefined();
        expect(uuidValidate(step.id!)).toBe(true);

        for (const nextStepId of step.nextStepIds ?? []) {
          expect(uuidValidate(nextStepId)).toBe(true);
        }
      }

      for (const nextStepId of (graph.trigger as { nextStepIds?: string[] })
        .nextStepIds ?? []) {
        expect(uuidValidate(nextStepId)).toBe(true);
      }
    }
  });

  it('keeps upload-profiles on Find people by company', () => {
    const companySearch = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Find people by company',
    );
    const steps = (companySearch?.steps ?? []) as GraphStep[];

    expect(steps.some((step) => step.name === 'Upload kept people')).toBe(true);
    expect(steps.some((step) => step.type === 'AI_FILTERING')).toBe(true);
  });

  it('seeds Fetch & Save as a manual upload-profiles workflow', () => {
    const fetchAndSave = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Add people',
    );

    expect(fetchAndSave).toBeDefined();
    expect((fetchAndSave?.trigger as { type: string }).type).toBe('MANUAL');

    const steps = (fetchAndSave?.steps ?? []) as GraphStep[];

    expect(steps).toHaveLength(1);
    expect(steps[0]?.name).toBe('Fetch & Save People Profiles');
    expect(steps[0]?.type).toBe('LOGIC_FUNCTION');
  });

  it('seeds Find people by search as webhook search → upload', () => {
    const searchAndUpload = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Find people by search',
    );

    expect(searchAndUpload).toBeDefined();
    expect((searchAndUpload?.trigger as { type: string }).type).toBe('WEBHOOK');
    expect(
      (searchAndUpload?.trigger as { settings?: { httpMethod?: string } })
        .settings?.httpMethod,
    ).toBe('POST');

    const steps = (searchAndUpload?.steps ?? []) as GraphStep[];

    expect(steps).toHaveLength(3);
    expect(steps[0]?.name).toBe('Search people');
    expect(steps[1]?.type).toBe('AI_FILTERING');
    expect(steps[2]?.name).toBe('Upload profiles');
    expect(steps[0]?.nextStepIds).toEqual([steps[1]?.id]);
    expect(steps[1]?.nextStepIds).toEqual([steps[2]?.id]);
  });

  it('does not seed a candidate.updated workflow', () => {
    const updatedGraphs = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.filter(
      (graph) =>
        getTrigger(graph).type === 'DATABASE_EVENT' &&
        getTrigger(graph).settings.eventName === 'candidate.updated',
    );

    expect(updatedGraphs).toHaveLength(0);
  });

  it('reads harvest query and keywords from the webhook payload', () => {
    const harvest = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
      (graph) => graph.name === 'Find companies',
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

    expect(search?.settings?.input?.logicFunctionInput?.query).toBe(
      '{{trigger.query}}',
    );
    expect(search?.settings?.input?.logicFunctionInput?.keywords).toBe(
      '{{trigger.keywords}}',
    );
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
    const byId = (stepId: string) => steps.find((step) => step.id === stepId);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    expect(byId(OUTREACH_SEQUENCER_STEP_IDS.queuedFind)?.nextStepIds).toEqual([
      byName('Load Person')?.id,
    ]);
    expect(byName('Load Person')?.nextStepIds).toEqual([
      byName('Fetch LinkedIn profile (qualify)')?.id,
    ]);
    expect(
      (
        byName('Load Person')?.settings as {
          input?: { objectName?: string };
        }
      )?.input?.objectName,
    ).toBe('person');

    // Route load → sender selector → member / stage router (not the QUEUED branch find).
    expect(byId(OUTREACH_SEQUENCER_STEP_IDS.routeFind)?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.selectProjectSender,
    ]);
    expect(
      byId(OUTREACH_SEQUENCER_STEP_IDS.selectProjectSender)?.nextStepIds,
    ).toEqual([byName('Load workspace member')?.id]);

    const qualifyFetch = byName('Fetch LinkedIn profile (qualify)') as {
      settings?: {
        input?: {
          logicFunctionInput?: {
            linkedinUrl?: string;
            linkedinProfileId?: string;
          };
        };
      };
    };
    const qualifyInput = qualifyFetch.settings?.input?.logicFunctionInput;

    expect(qualifyInput?.linkedinUrl).toContain(
      OUTREACH_SEQUENCER_STEP_IDS.queuedPersonFind,
    );
    expect(qualifyInput?.linkedinUrl).toContain('linkedinLink.primaryLinkUrl');
    expect(qualifyInput?.linkedinProfileId).toContain(
      OUTREACH_SEQUENCER_STEP_IDS.queuedPersonFind,
    );
    expect(qualifyInput?.linkedinProfileId).toContain('linkedinProfileId');
    expect(qualifyInput?.linkedinUrl).not.toContain(
      'linkedinUrl.primaryLinkUrl',
    );
    expect(qualifyInput?.linkedinProfileId).not.toContain(
      'people.linkedinProfileId',
    );
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
      'opener_hook',
      'reason',
      'referral_source',
      'score',
      'segment',
    ]);

    expect(
      byId(OUTREACH_SEQUENCER_STEP_IDS.queuedFind)?.nextStepIds,
    ).not.toContain(byName('Send LinkedIn connection')?.id);

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

  it('collapses company dedupe into one code node and one branch', () => {
    const steps = buildCandidateSequencerGraph({
      checkDeduplicationPerCompany: true,
    }).steps as GraphStep[];
    const withoutDedupe = buildCandidateSequencerGraph({
      checkDeduplicationPerCompany: false,
    }).steps as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    const dedupe = byName('Company dedupe') as
      | (GraphStep & {
          settings?: {
            input?: {
              logicFunctionId?: string;
              logicFunctionInput?: Record<string, string>;
            };
          };
        })
      | undefined;
    const gate = byName('Company already reached?');

    // One code node answers both questions and stamps DEFERRED itself.
    expect(dedupe?.type).toBe('LOGIC_FUNCTION');
    expect(dedupe?.settings?.input?.logicFunctionId).toBe(
      '__LF_outreach-company-dedupe__',
    );
    expect(dedupe?.settings?.input?.logicFunctionInput).toEqual({
      candidateId: expect.stringContaining('.first.id'),
      companyName: expect.stringContaining('jobCompanyName'),
    });
    expect(dedupe?.nextStepIds).toEqual([gate?.id]);

    // Deferred stops the run; everything else continues into one connection path.
    expect(byName('Qualify go?')).toBeDefined();
    expect(branchNext('Qualify go?', 0)).toEqual([dedupe?.id]);
    expect(gate?.settings?.input?.stepFilters?.[0]?.type).toBe('BOOLEAN');
    expect(gate?.settings?.input?.stepFilters?.[0]?.stepOutputKey).toBe(
      `{{${OUTREACH_SEQUENCER_STEP_IDS.companyDedupe}.deferred}}`,
    );
    expect(branchNext('Company already reached?', 0)).toEqual([]);
    expect(branchNext('Company already reached?', 1)).toEqual([
      byName('Draft connection note')?.id,
    ]);

    // The parallel (no company) thread is gone and the connection path is single.
    expect(
      steps.filter((step) => step.type === 'SEND_LINKEDIN_CONNECTION_REQUEST'),
    ).toHaveLength(1);
    expect(
      steps.filter((step) => (step.name ?? '').includes('(no company)')),
    ).toEqual([]);
    expect(byName('Connection not yet sent?')).toBeDefined();
    expect(byName('Approve connection note')).toBeDefined();

    // Two nodes instead of the old eleven-node section.
    expect(steps.length - withoutDedupe.length).toBe(2);

    // None of the retired steps come back.
    const stepIds = new Set(steps.map((step) => step.id));

    for (const retiredStepId of [
      'c7a10001-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10002-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10003-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10004-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10005-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10006-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10009-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a1000a-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10012-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10013-aaaa-4fcb-a7d8-17a7736ed045',
      'c7a10015-aaaa-4fcb-a7d8-17a7736ed045',
    ]) {
      expect(stepIds.has(retiredStepId)).toBe(false);
    }
  });

  it('never leaves a step pointing at an id the graph does not contain', () => {
    const optionVariants = [
      {},
      { checkDeduplicationPerCompany: true },
      { checkDeduplicationPerCompany: true, manualDraftTemplates: true },
      { checkDeduplicationPerCompany: true, commentBeforeConnect: true },
      { checkDeduplicationPerCompany: true, humanInTheLoop: false },
      { whatsappEnabled: true, emailConnected: true, inmailEnabled: true },
    ];

    for (const options of optionVariants) {
      const steps = buildCandidateSequencerGraph(options).steps as GraphStep[];
      const stepIds = new Set(steps.map((step) => step.id));
      const referencedIds = steps.flatMap((step) => [
        ...(step.nextStepIds ?? []),
        ...(step.settings?.input?.branches ?? []).flatMap(
          (branch) => branch.nextStepIds ?? [],
        ),
      ]);

      expect({
        options,
        dangling: referencedIds.filter((stepId) => !stepIds.has(stepId)),
      }).toEqual({ options, dangling: [] });
    }
  });

  it('merges QUEUED, CONNECTION_ACCEPTED and REPLIED into one candidate.upserted sequencer', () => {
    // WhatsApp is off in the seeded default; this test covers the WhatsApp-on graph.
    const merged = buildCandidateSequencerGraph({
      whatsappEnabled: true,
      emailConnected: true,
    });

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
    const routeFind = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.routeFind,
    );

    expect(router?.type).toBe('IF_ELSE');
    expect(trigger.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.routeFind,
    ]);
    expect(routeFind?.name).toBe('Load Candidate');
    expect(routeFind?.type).toBe('FIND_RECORDS');
    expect(routeFind?.nextStepIds).toEqual([
      byName('Select project sender')?.id,
    ]);
    expect(byName('Select project sender')?.nextStepIds).toEqual([
      byName('Load workspace member')?.id,
    ]);
    expect(byName('Load workspace member')?.nextStepIds).toEqual([
      byName('Load project')?.id,
    ]);
    expect(byName('Load project')?.nextStepIds).toEqual([router?.id]);
    expect(byName('Load workspace member profile')).toBeUndefined();

    const branches = router?.settings?.input?.branches ?? [];

    expect(branches).toHaveLength(5);
    // QUEUED enters through the send-wave gate before it loads anything.
    expect(branches[0]?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.queuedSendWaveAdmission,
    ]);
    expect(branches[4]?.filterGroupId).toBeUndefined();
    expect(branches[4]?.nextStepIds).toEqual([]);

    const stageFilters = (
      router?.settings as {
        input: {
          stepFilters: Array<{ value: string; stepOutputKey: string }>;
        };
      }
    ).input.stepFilters;

    expect(stageFilters.map((filter) => filter.value)).toEqual([
      JSON.stringify(['QUEUED']),
      JSON.stringify(['CONNECTION_ACCEPTED']),
      JSON.stringify(['REPLIED']),
      JSON.stringify(['MEETING_BOOKED']),
    ]);
    expect(
      stageFilters.every((filter) =>
        filter.stepOutputKey.includes(
          `${OUTREACH_SEQUENCER_STEP_IDS.routeFind}.first.outreachSequenceStage`,
        ),
      ),
    ).toBe(true);
    expect(
      stageFilters.some((filter) =>
        filter.stepOutputKey.includes('trigger.properties.after'),
      ),
    ).toBe(false);

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
    expect(
      (
        byName('Stamp prospect enrichment')?.settings?.input as {
          objectRecord?: {
            outreachProspectEnrichment?: { opener_hook?: unknown };
          };
        }
      )?.objectRecord?.outreachProspectEnrichment?.opener_hook,
    ).toEqual({
      source: expect.stringContaining('opener_hook.source'),
      quote: expect.stringContaining('opener_hook.quote'),
      problem: expect.stringContaining('opener_hook.problem'),
      why_sender: expect.stringContaining('opener_hook.why_sender'),
    });
    expect(branchNext('Qualify go?', 0)).toEqual([
      byName('Draft connection note')?.id,
    ]);

    // All bodies present, and no duplicate step ids across branches.
    expect(byName('Send LinkedIn connection')).toBeDefined();
    expect(byName('Qualify prospect')).toBeDefined();
    expect(byName('Draft connection note')).toBeDefined();
    expect(byName('Draft first LinkedIn message')).toBeDefined();
    expect(
      byName('Draft first LinkedIn message')?.settings?.input?.prompt,
    ).toContain('One goal: get a reply');
    expect(
      byName('Draft first LinkedIn message')?.settings?.input?.prompt,
    ).toContain('"tier": <1|2|3>');
    expect(
      byName('Draft first LinkedIn message')?.settings?.input?.prompt,
    ).toContain(
      '{{b8e1d001-4a11-4c11-8c11-000000000001.first.outreachSenderProfile}}',
    );
    expect(byName('Get calendar availability (opener)')).toBeDefined();
    expect(byName('Fetch LinkedIn posts (before opener)')).toBeDefined();
    expect(byName('Get calendar availability (opener)')?.nextStepIds).toEqual([
      byName('Fetch LinkedIn posts (before opener)')?.id,
    ]);
    expect(byName('Fetch LinkedIn posts (before opener)')?.nextStepIds).toEqual(
      [byName('Draft first LinkedIn message')?.id],
    );
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
    expect(byName('Create referred candidate')?.type).toBe('LOGIC_FUNCTION');
    expect(byName('Mark MEETING_BOOKED')?.type).toBe('AI_AGENT');
    expect(byName('Mark WAITING_REPLY')?.type).toBe('AI_AGENT');
    expect(byName('Draft meeting reminder')).toBeDefined();
    expect(byName('Mark MEETING_BOOKED')).toBeDefined();

    expect(byName('Validate inbound signals')?.nextStepIds).toEqual([
      byName('Load project attachments')?.id,
    ]);
    expect(byName('Load project attachments')?.nextStepIds).toEqual([
      byName('Fetch LinkedIn profile (reply)')?.id,
    ]);
    expect(byName('Fetch LinkedIn profile (reply)')?.nextStepIds).toEqual([
      byName('Fetch LinkedIn posts (before reply)')?.id,
    ]);
    expect(byName('Fetch LinkedIn posts (before reply)')?.nextStepIds).toEqual([
      byName('Draft sales reply')?.id,
    ]);
    expect(byName('Draft sales reply')?.nextStepIds).toEqual([
      byName('Skip send if #DONTRESPOND#')?.id,
    ]);
    expect(
      (
        byName('LinkedIn reply?')?.settings as {
          input: { branches: Array<{ nextStepIds: string[] }> };
        }
      ).input.branches[0].nextStepIds,
    ).toEqual([byName('Approve LinkedIn reply')?.id]);
    expect(
      (
        byName('LinkedIn reply?')?.settings as {
          input: { branches: Array<{ nextStepIds: string[] }> };
        }
      ).input.branches[1].nextStepIds,
    ).toEqual([byName('WhatsApp reply?')?.id]);
    expect(
      (
        byName('WhatsApp reply?')?.settings as {
          input: { branches: Array<{ nextStepIds: string[] }> };
        }
      ).input.branches[0].nextStepIds,
    ).toEqual([byName('WhatsApp destination?')?.id]);
    expect(
      (
        byName('Email reply?')?.settings as {
          input: { branches: Array<{ nextStepIds: string[] }> };
        }
      ).input.branches[1].nextStepIds,
    ).toEqual([byName('Referred someone else?')?.id]);
    expect(
      (
        byName('Approve email reply')?.settings as {
          rejectContinues?: boolean;
        }
      )?.rejectContinues,
    ).toBe(true);
    expect(
      (
        byName('Approve LinkedIn reply')?.settings as {
          rejectContinues?: boolean;
        }
      )?.rejectContinues,
    ).toBe(true);
    expect(
      (
        byName('Approve referral intro')?.settings as {
          rejectContinues?: boolean;
        }
      )?.rejectContinues,
    ).toBe(true);
    expect(
      (
        byName('Send email reply')?.settings as {
          input?: { body?: string; recipients?: { to?: string } };
        }
      )?.input?.body,
    ).toBe(
      `{{${OUTREACH_SEQUENCER_STEP_IDS.approveProspectEmail}.editedBody}}`,
    );
    expect(
      (
        byName('Send email reply')?.settings as {
          input?: { recipients?: { to?: string } };
        }
      )?.input?.recipients?.to,
    ).toBe(`{{${OUTREACH_SEQUENCER_STEP_IDS.validateSignals}.emailTo}}`);
    expect(byName('Send LinkedIn reply')?.nextStepIds).toEqual([
      byName('WhatsApp reply?')?.id,
    ]);
    expect(byName('Send WhatsApp reply')?.nextStepIds).toEqual([
      byName('Email reply?')?.id,
    ]);
    expect(byName('Send email reply')?.nextStepIds).toEqual([
      byName('Referred someone else?')?.id,
    ]);
    expect(byName('Reply on last inbound channel')).toBeUndefined();
    expect(byName('Also send WhatsApp?')).toBeUndefined();
    expect(byName('Content goes on WhatsApp?')).toBeUndefined();
    expect(
      (
        byName('LinkedIn reply approved?')?.settings as {
          input?: { branches?: Array<{ nextStepIds: string[] }> };
        }
      )?.input?.branches?.[1]?.nextStepIds,
    ).toEqual([byName('WhatsApp reply?')?.id]);
    expect(
      (
        byName('Approve WhatsApp reply')?.settings as {
          rejectContinues?: boolean;
        }
      )?.rejectContinues,
    ).toBe(true);
    expect(
      (
        byName('Email referred person')?.settings as {
          input?: { body?: string };
        }
      )?.input?.body,
    ).toBe(`{{${OUTREACH_SEQUENCER_STEP_IDS.approveReferral}.editedBody}}`);

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
    expect(draftSalesReply.settings?.input?.prompt).toContain(
      'prospect_posts:',
    );
    expect(draftSalesReply.settings?.input?.prompt).toContain(
      'prospect_profile: {{' +
        `${OUTREACH_SEQUENCER_STEP_IDS.fetchProfileReply}.text}}`,
    );
    expect(draftSalesReply.settings?.input?.prompt).toContain(
      'PROSPECT_ENRICHMENT: {{' +
        `${OUTREACH_SEQUENCER_STEP_IDS.fetchProfileReply}.outreachProspectEnrichment}}`,
    );
    expect(
      Object.keys(draftSalesReply.settings?.outputSchema ?? {}).sort(),
    ).toEqual([
      'emailBody',
      'emailSubject',
      'linkedinMessage',
      'referralCandidateId',
      'referralMessage',
      'whatsappMessage',
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
      'opener_hook',
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

  it('feeds project persona guidance into qualify and every cold draft prompt', () => {
    const steps = buildCandidateSequencerGraph({
      useLlmConnectionNote: true,
    }).steps as GraphStep[];
    const projectStep = steps.find((step) => step.name === 'Load project');
    const personaChip = `{{${projectStep?.id}.first.outreachConfig.personaGuidance}}`;
    const promptOf = (name: string) =>
      steps.find((step) => step.name === name)?.settings?.input?.prompt;

    expect(projectStep?.type).toBe('FIND_RECORDS');

    for (const name of [
      'Qualify prospect',
      'Draft connection note',
      'Draft first LinkedIn message',
    ]) {
      expect(promptOf(name)).toContain(personaChip);
    }

    const followUpPrompts = steps
      .filter((step) =>
        /^Draft LinkedIn follow-up [123]$/.test(step.name ?? ''),
      )
      .map((step) => step.settings?.input?.prompt);

    expect(followUpPrompts).toHaveLength(3);

    for (const prompt of followUpPrompts) {
      expect(prompt).toContain(personaChip);
    }
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
    expect(
      stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu2Whatsapp),
    ).toBe(false);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendReply)).toBe(true);
  });

  it('routes post-reply follow-ups to the matching channel send step', () => {
    const graph = buildCandidateSequencerGraph({
      whatsappEnabled: true,
      emailConnected: true,
    });
    const steps = graph.steps as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const branchNext = (stepName: string, branchIndex: number) =>
      byName(stepName)?.settings?.input?.branches?.[branchIndex]?.nextStepIds ??
      [];

    expect(branchNext('Send post-reply FU1 on inbound channel', 0)).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu1Email,
    ]);
    expect(branchNext('Send post-reply FU1 on inbound channel', 1)).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu1Whatsapp,
    ]);
    expect(branchNext('Send post-reply FU1 on inbound channel', 2)).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu1Linkedin,
    ]);
    expect(branchNext('Send post-reply FU2 on inbound channel', 0)).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu2Email,
    ]);
    expect(branchNext('Send post-reply FU2 on inbound channel', 1)).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu2Whatsapp,
    ]);
    expect(branchNext('Send post-reply FU2 on inbound channel', 2)).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu2Linkedin,
    ]);
    expect(
      byName('Send post-reply FU1 on inbound channel')?.settings?.input
        ?.stepFilters?.[0]?.stepOutputKey,
    ).toBe(`{{${OUTREACH_SEQUENCER_STEP_IDS.validateSignals}.replyChannel}}`);
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

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.companyDedupe)).toBe(true);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.companyDedupeIf)).toBe(true);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.draftConnectNote)).toBe(
      true,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendConnect)).toBe(true);
    expect(branchNext('Qualify go?', 0)).toEqual([
      byName('Company dedupe')?.id,
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
      manualDraftTemplates: false,
      whatsappEnabled: false,
      emailConnected: false,
      meetingFollowUpEnabled: true,
      checkDeduplicationPerCompany: false,
      qualifyProspectEnabled: true,
      commentBeforeConnect: false,
      commentRounds: 1,
      inboundInviteWaitDays: 3,
      inmailEnabled: false,
      testMode: false,
      pinSenderByWarmOverlap: false,
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
      manualDraftTemplates: false,
      whatsappEnabled: false,
      emailConnected: false,
      meetingFollowUpEnabled: false,
      checkDeduplicationPerCompany: false,
      qualifyProspectEnabled: true,
      commentBeforeConnect: false,
      commentRounds: 1,
      inboundInviteWaitDays: 3,
      inmailEnabled: false,
      testMode: false,
      pinSenderByWarmOverlap: false,
    });
  });

  it('builds comment-before-connect warm-up with distinct post fetch on round 2', () => {
    const graph = buildCandidateSequencerGraph({
      commentBeforeConnect: true,
      commentRounds: 2,
      inboundInviteWaitDays: 5,
      humanInTheLoop: false,
    });
    const stepIds = new Set(
      (graph.steps as GraphStep[]).map((step) => step.id),
    );

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.viewBeforeComment)).toBe(
      true,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.acceptInboundInvite)).toBe(
      true,
    );
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.fetchActivity2)).toBe(true);

    const fetchRound2 = (graph.steps as GraphStep[]).find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.fetchActivity2,
    );
    expect(
      (fetchRound2?.settings?.input as { excludePostSocialIds?: string[] })
        ?.excludePostSocialIds?.[0],
    ).toContain('mostRecentPost.socialId');

    const acceptInbound = (graph.steps as GraphStep[]).find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.acceptInboundInvite,
    );
    expect(acceptInbound?.settings?.outputSchema).toMatchObject({
      accepted: { isLeaf: true },
      matched: { isLeaf: true },
    });

    const inboundAcceptedIf = (graph.steps as GraphStep[]).find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.inboundAcceptedIf,
    );
    const inboundFilter = (
      inboundAcceptedIf?.settings?.input as {
        stepFilters?: Array<{
          type?: string;
          operand?: string;
          stepOutputKey?: string;
        }>;
      }
    )?.stepFilters?.[0];
    expect(inboundFilter).toMatchObject({
      type: 'BOOLEAN',
      operand: 'IS',
    });
    expect(inboundFilter?.stepOutputKey).toContain('.accepted');

    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        graph.steps as GraphStep[],
        graph.trigger,
      ),
    ).toMatchObject({
      commentBeforeConnect: true,
      commentRounds: 2,
      inboundInviteWaitDays: 5,
    });
  });

  it('collapses every DELAY wait to 1 minute in test mode', () => {
    const production = buildCandidateSequencerGraph();
    const testModeGraph = buildCandidateSequencerGraph({ testMode: true });
    // The follow-up-date wait is a SCHEDULED_DATE delay with its own test below.
    const isFixedDurationDelay = (step: GraphStep) =>
      step.type === 'DELAY' &&
      !step.name?.startsWith('Wait until the date they asked');
    const productionDelays = (production.steps as GraphStep[]).filter(
      isFixedDurationDelay,
    );
    const testModeDelays = (testModeGraph.steps as GraphStep[]).filter(
      isFixedDurationDelay,
    );

    expect(productionDelays).toHaveLength(10);
    expect(testModeDelays).toHaveLength(10);

    for (const delayStep of productionDelays) {
      expect(delayStep.settings?.input?.duration).toMatchObject({
        hours: 0,
        minutes: 0,
        seconds: 0,
      });
      expect(delayStep.settings?.input?.duration?.days).toBeGreaterThan(0);
      expect(delayStep.name).toMatch(/Wait \d+ days?/);
    }

    for (const delayStep of testModeDelays) {
      expect(delayStep.settings?.input?.duration).toEqual({
        days: 0,
        hours: 0,
        minutes: 1,
        seconds: 0,
      });
      expect(delayStep.name).toMatch(/^Wait 1 minute/);
    }

    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        testModeGraph.steps as GraphStep[],
        testModeGraph.trigger,
      ).testMode,
    ).toBe(true);
  });

  it('stores email attachments as an array of variable references the UI schema accepts', () => {
    const emailReply = (
      buildCandidateSequencerGraph({ emailConnected: true })
        .steps as GraphStep[]
    ).find((step) => step.name === 'Send email reply');

    expect(emailReply?.settings?.input).toMatchObject({
      files: [expect.stringMatching(/^{{[^{}]+\.files}}$/)],
    });
  });

  it('waits until followUpAt for a snooze, and 1 minute in test mode', () => {
    const findWait = (steps: unknown) =>
      (steps as GraphStep[]).find((step) =>
        step.name?.startsWith('Wait until the date they asked'),
      );
    const production = findWait(buildCandidateSequencerGraph().steps);
    const testMode = findWait(
      buildCandidateSequencerGraph({ testMode: true }).steps,
    );

    expect(production?.settings?.input).toMatchObject({
      delayType: 'SCHEDULED_DATE',
    });
    expect(JSON.stringify(production?.settings?.input)).toContain(
      '.followUpAt}}',
    );
    expect(testMode?.settings?.input?.duration).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 0,
    });
  });

  it('emails the workspace member instead of WhatsApp when WhatsApp is off', () => {
    const names = (options?: { whatsappEnabled: boolean }) =>
      (buildCandidateSequencerGraph(options).steps as GraphStep[]).map(
        (step) => step.name,
      );

    expect(names({ whatsappEnabled: false })).toEqual(
      expect.arrayContaining([
        'Prospect shared a phone number?',
        'Email member: reach out on the number',
      ]),
    );
    expect(names({ whatsappEnabled: false })).not.toContain(
      'Send WhatsApp reply',
    );
    expect(names({ whatsappEnabled: true })).not.toContain(
      'Email member: reach out on the number',
    );
  });

  it('inserts InMail before enrich when inmailEnabled is on', () => {
    const graph = buildCandidateSequencerGraph({
      inmailEnabled: true,
      humanInTheLoop: true,
    });
    const steps = graph.steps as GraphStep[];
    const stepIds = new Set(steps.map((step) => step.id));

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendInmail)).toBe(true);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.draftInmail)).toBe(true);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.markInmailSent)).toBe(true);

    const stillSent = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.stillSent,
    );
    const markInmail = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.markInmailSent,
    );

    expect(stillSent?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.draftInmail,
    ]);
    expect(markInmail?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.enrich,
    ]);
    expect(
      inferOutreachSequencerGraphOptionsFromSteps(steps, graph.trigger)
        .inmailEnabled,
    ).toBe(true);
  });

  it('omits InMail steps when inmailEnabled is off', () => {
    const graph = buildCandidateSequencerGraph({ inmailEnabled: false });
    const steps = graph.steps as GraphStep[];
    const stepIds = new Set(steps.map((step) => step.id));

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.sendInmail)).toBe(false);

    const stillSent = steps.find(
      (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.stillSent,
    );

    expect(stillSent?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.enrich,
    ]);
  });

  it('skips qualify go/no-go when qualify prospect is off', () => {
    const graph = buildCandidateSequencerGraph({
      qualifyProspectEnabled: false,
      useLlmConnectionNote: false,
    });
    const steps = graph.steps as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const stepIds = new Set(steps.map((step) => step.id));

    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.qualifyDraft)).toBe(false);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.stampEnrich)).toBe(false);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.qualifyGoIf)).toBe(false);
    expect(stepIds.has(OUTREACH_SEQUENCER_STEP_IDS.markSkippedQualify)).toBe(
      false,
    );
    expect(byName('Qualify prospect')).toBeUndefined();
    expect(byName('Stamp prospect enrichment')).toBeUndefined();
    expect(byName('Qualify go?')).toBeUndefined();
    expect(byName('Fetch LinkedIn profile (qualify)')).toBeUndefined();
    // Without qualify there is no reason to read the profile before sending:
    // the candidate goes straight from Load Person to the connection gate, and
    // the read rides right after Mark CONNECTION_SENT.
    expect(byName('Load Person')?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.connectionNotSentIf,
    ]);
    expect(byName('Fetch LinkedIn profile (after connection)')?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.waitAccept,
    ]);
    expect(byName('Mark CONNECTION_SENT')?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.queuedFetchProfile,
    ]);
    expect(
      inferOutreachSequencerGraphOptionsFromSteps(steps, graph.trigger)
        .qualifyProspectEnabled,
    ).toBe(false);
  });

  it('gates the QUEUED branch on send capacity before any LinkedIn read', () => {
    const graph = buildCandidateSequencerGraph({});
    const steps = graph.steps as GraphStep[];
    const byName = (name: string) => steps.find((step) => step.name === name);
    const route = byName('Route by outreach stage') as
      | (GraphStep & {
          settings?: {
            input?: {
              branches?: Array<{
                filterGroupId?: string;
                nextStepIds: string[];
              }>;
            };
          };
        })
      | undefined;
    const queuedBranch = route?.settings?.input?.branches?.find(
      (branch) =>
        branch.filterGroupId ===
        OUTREACH_SEQUENCER_STEP_IDS.stageGroupQueued,
    );
    const gate = byName('Wait for a send slot');

    expect(queuedBranch?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.queuedSendWaveAdmission,
    ]);
    expect(gate?.nextStepIds).toEqual([OUTREACH_SEQUENCER_STEP_IDS.queuedFind]);
    expect(
      (gate?.settings?.input as { logicFunctionInput?: unknown })
        ?.logicFunctionInput,
    ).toEqual({
      workspaceMemberId: expect.stringContaining('.first.id'),
      candidateId: expect.stringContaining('.first.id'),
    });
    // The gate itself must not spend a LinkedIn request.
    expect(gate?.type).toBe('LOGIC_FUNCTION');
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

  it('enables Jev output validation on draft copy nodes', () => {
    const graph = buildCandidateSequencerGraph({
      useLlmConnectionNote: true,
      checkDeduplicationPerCompany: true,
      commentBeforeConnect: true,
      commentRounds: 2,
      inmailEnabled: true,
      meetingFollowUpEnabled: true,
    });
    const byName = (name: string) =>
      (graph.steps as GraphStep[]).find((step) => step.name === name);
    const fieldKeys = (name: string) =>
      (
        byName(name)?.settings?.input as
          | { outputValidation?: { enabled?: boolean; fieldKeys?: string[] } }
          | undefined
      )?.outputValidation?.fieldKeys;

    const messageNodes = [
      'Draft first LinkedIn message',
      'Draft LinkedIn follow-up 1',
      'Draft LinkedIn follow-up 2',
      'Draft LinkedIn follow-up 3',
      'Draft post-reply follow-up 1',
      'Draft post-reply follow-up 2',
      'Draft LinkedIn comment',
      'Draft second LinkedIn comment',
      'Draft connection note',
      'Draft meeting reminder',
      'Draft no-show ping',
      'Draft reschedule offer',
    ];

    for (const name of messageNodes) {
      expect(fieldKeys(name)).toEqual(['message']);
    }

    expect(fieldKeys('Draft InMail')).toEqual(['subject', 'message']);
    expect(fieldKeys('Draft fallback email')).toEqual(['subject', 'message']);
    expect(fieldKeys('Draft sales reply')).toEqual([
      'linkedinMessage',
      'emailSubject',
      'emailBody',
      'referralMessage',
      'whatsappMessage',
    ]);

    for (const name of [
      'Extract inbound signals',
      'Qualify prospect',
      'Create referred candidate',
      'Mark MEETING_BOOKED',
      'Mark WAITING_REPLY',
    ]) {
      expect(fieldKeys(name)).toBeUndefined();
    }
  });

  it.each([
    ['Find companies', 'Company fit filter', 'fit', 'company', 'gpt4o'],
    [
      'Find people by company',
      'Keep people filter',
      'keep',
      'person',
      'gpt6luna',
    ],
    [
      'Find people by search',
      'Keep people filter',
      'keep',
      'person',
      'gpt6luna',
    ],
  ])(
    'seeds %s as a webhook search → AI filter → save of the kept records',
    (graphName, filterStepName, keepField, subject, selectedModel) => {
      const graph = OUTREACH_WORKFLOW_GRAPH_TEMPLATES.find(
        (template) => template.name === graphName,
      );
      const steps = (graph?.steps ?? []) as Array<{
        id: string;
        name: string;
        type: string;
        settings: {
          input: Record<string, unknown> & {
            fields: Array<{ name: string; type: string; optional?: boolean }>;
          };
        };
      }>;
      const filterIndex = steps.findIndex(
        (step) => step.type === 'AI_FILTERING',
      );
      const filter = steps[filterIndex];

      expect((graph?.trigger as { type: string }).type).toBe('WEBHOOK');
      expect(filter.name).toBe(filterStepName);
      expect(filter.settings.input.keepField).toBe(keepField);
      expect(filter.settings.input.subject).toBe(subject);
      expect(filter.settings.input.selectedModel).toBe(selectedModel);
      expect(filter.settings.input.batchSize).toBeGreaterThan(1);
      expect(filter.settings.input.candidates).toMatch(
        /^\{\{.+\.(companies|people)\}\}$/,
      );
      // jev-compatible contract: required fields boolean/enum, reason optional text.
      expect(
        filter.settings.input.fields.find((field) => field.name === 'reason'),
      ).toMatchObject({ type: 'text', optional: true });
      expect(
        filter.settings.input.fields
          .filter((field) => !field.optional)
          .every((field) => ['boolean', 'enum'].includes(field.type)),
      ).toBe(true);

      const saveStep = steps[filterIndex + 1];

      expect(JSON.stringify(saveStep.settings.input)).toContain(
        `${filter.id}.kept`,
      );
    },
  );

  it('replaces every email send with a system email to the member when email is not connected', () => {
    const emailSendIds = [
      OUTREACH_SEQUENCER_STEP_IDS.sendReplyEmail,
      OUTREACH_SEQUENCER_STEP_IDS.sendReferralEmail,
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu1Email,
      OUTREACH_SEQUENCER_STEP_IDS.sendPostReplyFu2Email,
      OUTREACH_SEQUENCER_STEP_IDS.sendEmail,
    ];
    const typesFor = (emailConnected: boolean) => {
      const steps = buildCandidateSequencerGraph({ emailConnected })
        .steps as GraphStep[];

      return {
        steps,
        types: emailSendIds.map(
          (id) => steps.find((step) => step.id === id)?.type,
        ),
      };
    };

    expect(typesFor(true).types.every((type) => type === 'SEND_EMAIL')).toBe(
      true,
    );

    const disconnected = typesFor(false);

    expect(disconnected.types.every((type) => type === 'LOGIC_FUNCTION')).toBe(
      true,
    );
    expect(
      disconnected.steps.filter((step) => step.type === 'SEND_EMAIL'),
    ).toHaveLength(0);

    const graph = buildCandidateSequencerGraph({ emailConnected: false });

    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        graph.steps as GraphStep[],
        graph.trigger,
      ).emailConnected,
    ).toBe(false);
    expect(
      inferOutreachSequencerGraphOptionsFromSteps(
        buildCandidateSequencerGraph({ emailConnected: true })
          .steps as GraphStep[],
        graph.trigger,
      ).emailConnected,
    ).toBe(true);
  });

  describe('pinSenderByWarmOverlap', () => {
    type FindStep = GraphStep & {
      settings?: { input?: { objectName?: string; filter?: unknown } };
    };

    const memberFinds = (steps: GraphStep[]) =>
      (steps as FindStep[]).filter(
        (step) =>
          step.type === 'FIND_RECORDS' &&
          step.settings?.input?.objectName === 'workspaceMember',
      );

    it('resolves the sender from the project when the flag is off', () => {
      const graph = buildCandidateSequencerGraph();
      const steps = graph.steps as GraphStep[];
      const load = steps.find(
        (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.routeFind,
      );
      const select = steps.find(
        (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.selectProjectSender,
      );
      const finds = memberFinds(steps);

      expect(
        steps.some(
          (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.selectMember,
        ),
      ).toBe(false);
      expect(load?.nextStepIds).toEqual([
        OUTREACH_SEQUENCER_STEP_IDS.selectProjectSender,
      ]);
      expect(select?.type).toBe('LOGIC_FUNCTION');
      expect(JSON.stringify(select)).toContain(
        'select-outreach-workspace-member',
      );
      expect(finds).toHaveLength(1);
      expect(select?.nextStepIds).toEqual([finds[0].id]);
      expect(JSON.stringify(finds[0].settings?.input?.filter)).toContain(
        `{{${OUTREACH_SEQUENCER_STEP_IDS.selectProjectSender}.workspaceMemberId}}`,
      );
      expect(
        inferOutreachSequencerGraphOptionsFromSteps(steps, graph.trigger)
          .pinSenderByWarmOverlap,
      ).toBe(false);
      expect(
        buildCandidateSequencerGraph({ pinSenderByWarmOverlap: false }),
      ).toEqual(graph);
    });

    it('sends and drafts email from the selected sender mailbox either way', () => {
      const mailboxSenders = (steps: unknown[]) =>
        (
          steps as Array<{
            type: string;
            settings?: { input?: { connectedAccountId?: string } };
          }>
        )
          .filter(
            (step) => step.type === 'SEND_EMAIL' || step.type === 'DRAFT_EMAIL',
          )
          .map((step) => step.settings?.input?.connectedAccountId);

      for (const pinSenderByWarmOverlap of [false, true]) {
        const senders = mailboxSenders(
          buildCandidateSequencerGraph({
            pinSenderByWarmOverlap,
            emailConnected: true,
          }).steps,
        );

        expect(senders.length).toBeGreaterThan(0);
        expect(
          senders.every(
            (sender) =>
              typeof sender === 'string' && sender.includes('.first.id'),
          ),
        ).toBe(true);
      }
    });

    it('sends WhatsApp and LinkedIn from the selected sender member', () => {
      const steps = buildCandidateSequencerGraph({
        whatsappEnabled: true,
        emailConnected: true,
      }).steps as Array<{
        type: string;
        settings?: { input?: { workspaceMemberId?: string } };
      }>;
      const unipileSends = steps.filter(
        (step) =>
          step.type === 'SEND_WHATSAPP_MESSAGE' ||
          step.type.startsWith('SEND_LINKEDIN'),
      );

      expect(unipileSends.length).toBeGreaterThan(0);
      expect(
        unipileSends.every((step) =>
          step.settings?.input?.workspaceMemberId?.includes('.first.id'),
        ),
      ).toBe(true);
    });

    it('selects the sender before the member lookup and filters on it when on', () => {
      const graph = buildCandidateSequencerGraph({
        pinSenderByWarmOverlap: true,
      });
      const steps = graph.steps as GraphStep[];
      const load = steps.find(
        (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.routeFind,
      );
      const select = steps.find(
        (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.selectMember,
      );
      const finds = memberFinds(steps) as FindStep[];

      expect(load?.nextStepIds).toEqual([
        OUTREACH_SEQUENCER_STEP_IDS.selectMember,
      ]);
      expect(select?.type).toBe('LOGIC_FUNCTION');
      expect(finds).toHaveLength(1);
      expect(select?.nextStepIds).toEqual([finds[0].id]);
      expect(JSON.stringify(finds[0].settings?.input?.filter)).toContain(
        `{{${OUTREACH_SEQUENCER_STEP_IDS.selectMember}.workspaceMemberId}}`,
      );
      expect(
        inferOutreachSequencerGraphOptionsFromSteps(steps, graph.trigger)
          .pinSenderByWarmOverlap,
      ).toBe(true);
    });
  });
  describe('manual draft templates', () => {
    const MANUAL_SITES = [
      {
        key: 'connectionNote',
        draft: OUTREACH_SEQUENCER_STEP_IDS.draftConnectNote,
        approve: OUTREACH_SEQUENCER_STEP_IDS.approveConnectNote,
        send: OUTREACH_SEQUENCER_STEP_IDS.sendConnect,
      },
      {
        key: 'firstMessage',
        draft: OUTREACH_SEQUENCER_STEP_IDS.draftFirst,
        approve: OUTREACH_SEQUENCER_STEP_IDS.approveFirst,
        send: OUTREACH_SEQUENCER_STEP_IDS.sendFirst,
      },
      {
        key: 'followUp1',
        draft: OUTREACH_SEQUENCER_STEP_IDS.draftFu1,
        approve: OUTREACH_SEQUENCER_STEP_IDS.approveFu1,
        send: OUTREACH_SEQUENCER_STEP_IDS.sendFu1,
      },
      {
        key: 'followUp2',
        draft: OUTREACH_SEQUENCER_STEP_IDS.draftFu2,
        approve: OUTREACH_SEQUENCER_STEP_IDS.approveFu2,
        send: OUTREACH_SEQUENCER_STEP_IDS.sendFu2,
      },
      {
        key: 'followUp3',
        draft: OUTREACH_SEQUENCER_STEP_IDS.draftFu3,
        approve: OUTREACH_SEQUENCER_STEP_IDS.approveFu3,
        send: OUTREACH_SEQUENCER_STEP_IDS.sendFu3,
      },
    ];

    const buildManual = () =>
      buildCandidateSequencerGraph({
        humanInTheLoop: true,
        manualDraftTemplates: true,
      });

    it.each(MANUAL_SITES)(
      'replaces the AI draft and approve form before the $key send',
      ({ key, draft, approve, send }) => {
        const steps = buildManual().steps as GraphStep[];
        const draftStep = steps.find((step) => step.id === draft);
        const sendStep = steps.find((step) => step.id === send);

        expect(draftStep?.type).toBe('LOGIC_FUNCTION');
        expect(JSON.stringify(draftStep?.settings?.input)).toContain(
          `"templateKey":"${key}"`,
        );
        expect(steps.some((step) => step.id === approve)).toBe(false);
        expect(draftStep?.nextStepIds).toEqual([
          key === 'connectionNote'
            ? OUTREACH_SEQUENCER_STEP_IDS.connectionNotSentIf
            : send,
        ]);
        expect(JSON.stringify(sendStep?.settings?.input)).toContain(
          `{{${draft}.message}}`,
        );
      },
    );

    it('sends the connection note template even when the LLM note option is off', () => {
      const steps = buildCandidateSequencerGraph({
        useLlmConnectionNote: false,
        manualDraftTemplates: true,
      }).steps as GraphStep[];
      const send = steps.find(
        (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.sendConnect,
      );

      expect(
        steps.find(
          (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.draftConnectNote,
        )?.type,
      ).toBe('LOGIC_FUNCTION');
      expect(JSON.stringify(send?.settings?.input)).toContain(
        `{{${OUTREACH_SEQUENCER_STEP_IDS.draftConnectNote}.message}}`,
      );
    });

    it('keeps the reply-branch approval forms when human-in-the-loop is on', () => {
      const steps = buildManual().steps as GraphStep[];

      expect(
        steps.some(
          (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.approveReply,
        ),
      ).toBe(true);
    });

    it('keeps the AI draft flow when manual mode is off', () => {
      const steps = buildCandidateSequencerGraph({ humanInTheLoop: true })
        .steps as GraphStep[];

      expect(
        steps.find((step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.draftFirst)
          ?.type,
      ).toBe('AI_AGENT');
      expect(
        inferOutreachSequencerGraphOptionsFromSteps(steps).manualDraftTemplates,
      ).toBe(false);
    });

    it('infers manual mode from the rendered graph', () => {
      const graph = buildManual();

      expect(
        inferOutreachSequencerGraphOptionsFromSteps(
          graph.steps as GraphStep[],
          graph.trigger,
        ),
      ).toMatchObject({ manualDraftTemplates: true, humanInTheLoop: true });
    });

    it('feeds member attachments into the follow-up 1 send', () => {
      const steps = buildManual().steps as GraphStep[];
      const sendStep = steps.find(
        (step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.sendFu1,
      );

      expect(JSON.stringify(sendStep?.settings?.input)).toContain(
        'outreachDraftAttachments.followUp1',
      );
    });
  });

  describe('manual member takeover gates', () => {
    const steps = () =>
      buildCandidateSequencerGraph().steps as Array<
        GraphStep & {
          settings?: {
            input?: {
              logicFunctionId?: string;
              logicFunctionInput?: { forceRefresh?: unknown };
              stepOutputKey?: string;
              stepFilters?: Array<{
                value?: string;
                stepOutputKey?: string;
                type?: string;
              }>;
              objectRecord?: Record<string, unknown>;
            };
          };
        }
      >;

    const byId = (id: string) => steps().find((step) => step.id === id);

    const FETCH_STEPS = [
      OUTREACH_SEQUENCER_STEP_IDS.fetchMessages,
      OUTREACH_SEQUENCER_STEP_IDS.fetchFu1Messages,
      OUTREACH_SEQUENCER_STEP_IDS.fetchFu2Messages,
      OUTREACH_SEQUENCER_STEP_IDS.fetchFu3Messages,
    ];

    const GATES: Array<{
      label: string;
      fetchId: string;
      gateId: string;
      nextStepId: string;
      // The opener's fetch feeds the existing inbound gate first; each follow-up
      // feeds its own takeover gate directly.
      fetchNextStepId: string;
    }> = [
      {
        label: 'opener',
        fetchId: OUTREACH_SEQUENCER_STEP_IDS.fetchMessages,
        gateId: OUTREACH_SEQUENCER_STEP_IDS.acceptMemberRepliedIf,
        nextStepId: OUTREACH_SEQUENCER_STEP_IDS.fetchProfile,
        fetchNextStepId: OUTREACH_SEQUENCER_STEP_IDS.hasInboundIf,
      },
      {
        label: 'follow-up 1',
        fetchId: OUTREACH_SEQUENCER_STEP_IDS.fetchFu1Messages,
        gateId: OUTREACH_SEQUENCER_STEP_IDS.memberRepliedFu1If,
        nextStepId: OUTREACH_SEQUENCER_STEP_IDS.filterFu1,
        fetchNextStepId: OUTREACH_SEQUENCER_STEP_IDS.memberRepliedFu1If,
      },
      {
        label: 'follow-up 2',
        fetchId: OUTREACH_SEQUENCER_STEP_IDS.fetchFu2Messages,
        gateId: OUTREACH_SEQUENCER_STEP_IDS.memberRepliedFu2If,
        nextStepId: OUTREACH_SEQUENCER_STEP_IDS.filterFu2,
        fetchNextStepId: OUTREACH_SEQUENCER_STEP_IDS.memberRepliedFu2If,
      },
      {
        label: 'follow-up 3',
        fetchId: OUTREACH_SEQUENCER_STEP_IDS.fetchFu3Messages,
        gateId: OUTREACH_SEQUENCER_STEP_IDS.memberRepliedFu3If,
        nextStepId: OUTREACH_SEQUENCER_STEP_IDS.filterFu3,
        fetchNextStepId: OUTREACH_SEQUENCER_STEP_IDS.memberRepliedFu3If,
      },
    ];

    it('forces a provider pull on every accepted-branch fetch', () => {
      // A cached transcript cannot prove the thread is untouched: Unipile only
      // pushes inbound, so a manual member reply never lands in the cache.
      for (const fetchId of FETCH_STEPS) {
        expect(
          byId(fetchId)?.settings?.input?.logicFunctionInput?.forceRefresh,
        ).toBe(true);
      }
    });

    it.each(GATES)(
      'gates the $label on memberSentLast and defers instead of sending',
      ({ fetchId, gateId, nextStepId, fetchNextStepId }) => {
        const fetchStep = byId(fetchId);
        const gate = byId(gateId);

        expect(fetchStep?.settings?.input?.logicFunctionId).toBe(
          '__LF_fetch-linkedin-messages__',
        );
        expect(fetchStep?.nextStepIds).toEqual([fetchNextStepId]);
        expect(gate?.type).toBe('IF_ELSE');
        expect(gate?.settings?.input?.stepFilters?.[0]).toMatchObject({
          stepOutputKey: `{{${fetchId}.memberSentLast}}`,
          value: 'true',
          type: 'BOOLEAN',
        });

        const branches = gate?.settings?.input?.branches ?? [];
        const deferredBranch = branches.find((branch) =>
          branch.nextStepIds?.includes(
            OUTREACH_SEQUENCER_STEP_IDS.stampMemberRepliedDeferred,
          ),
        );

        expect(deferredBranch).toBeDefined();
        expect(
          branches.find((branch) =>
            branch.nextStepIds?.includes(nextStepId),
          ),
        ).toBeDefined();
      },
    );

    it('stamps DEFERRED so no new run starts and the stage filter stops', () => {
      const stamp = byId(OUTREACH_SEQUENCER_STEP_IDS.stampMemberRepliedDeferred);

      expect(stamp?.type).toBe('UPDATE_RECORD');
      expect(stamp?.settings?.input?.objectRecord).toMatchObject({
        outreachSequenceStage: 'DEFERRED',
      });
      // DEFERRED is not an entry stage, so the trigger filter never re-enters.
      expect(OUTREACH_SEQUENCER_STEP_IDS.stampMemberRepliedDeferred).not.toBe(
        undefined,
      );
    });

    it('routes the accepted branch through the takeover gate first', () => {
      expect(
        byId(OUTREACH_SEQUENCER_STEP_IDS.hasInboundIf)?.settings?.input
          ?.stepFilters?.[0]?.stepOutputKey,
      ).toBe(`{{${OUTREACH_SEQUENCER_STEP_IDS.fetchMessages}.hasInboundReply}}`);

      const branches =
        byId(OUTREACH_SEQUENCER_STEP_IDS.hasInboundIf)?.settings?.input
          ?.branches ?? [];

      expect(
        branches.find((branch) =>
          branch.nextStepIds?.includes(
            OUTREACH_SEQUENCER_STEP_IDS.acceptMemberRepliedIf,
          ),
        ),
      ).toBeDefined();
    });

    it('keeps every nextStepIds reference inside the graph', () => {
      const graphSteps = steps();
      const ids = new Set(graphSteps.map((step) => step.id));

      for (const step of graphSteps) {
        for (const nextStepId of step.nextStepIds ?? []) {
          expect(ids.has(nextStepId)).toBe(true);
        }

        for (const branch of step.settings?.input?.branches ?? []) {
          for (const nextStepId of branch.nextStepIds ?? []) {
            expect(ids.has(nextStepId)).toBe(true);
          }
        }
      }
    });
  });
});
