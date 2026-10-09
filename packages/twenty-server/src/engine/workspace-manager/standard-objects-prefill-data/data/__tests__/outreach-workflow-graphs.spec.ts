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

    // Route load sits before member / stage router (not the QUEUED branch find).
    expect(byId(OUTREACH_SEQUENCER_STEP_IDS.routeFind)?.nextStepIds).toEqual([
      byName('Load workspace member')?.id,
    ]);

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
      byName('Load workspace member')?.id,
    ]);
    expect(byName('Load workspace member')?.nextStepIds).toEqual([router?.id]);
    expect(byName('Load workspace member profile')).toBeUndefined();

    const branches = router?.settings?.input?.branches ?? [];

    expect(branches).toHaveLength(5);
    expect(branches[0]?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.queuedFind,
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
    ).toContain('Would you be open to a quick chat coming Thursday or Friday?');
    expect(
      byName('Draft first LinkedIn message')?.settings?.input?.prompt,
    ).toContain('{{b8e1d001-4a11-4c11-8c11-000000000001.text}}');
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
    expect(byName('Fetch LinkedIn profile')?.nextStepIds).toEqual([
      OUTREACH_SEQUENCER_STEP_IDS.connectionNotSentIf,
    ]);
    expect(
      inferOutreachSequencerGraphOptionsFromSteps(steps, graph.trigger)
        .qualifyProspectEnabled,
    ).toBe(false);
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
      'Draft connection note (no company)',
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
      'gpt4omini',
    ],
    [
      'Find people by search',
      'Keep people filter',
      'keep',
      'person',
      'gpt4omini',
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

    expect(
      disconnected.types.every((type) => type === 'LOGIC_FUNCTION'),
    ).toBe(true);
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

    it('keeps the unfiltered first-member lookup when the flag is off', () => {
      const graph = buildCandidateSequencerGraph();
      const steps = graph.steps as GraphStep[];

      expect(steps.some((step) => step.id === OUTREACH_SEQUENCER_STEP_IDS.selectMember)).toBe(false);
      expect(JSON.stringify(graph)).not.toContain('select-outreach-workspace-member');
      expect(JSON.stringify(graph)).not.toContain('__FIELD_workspaceMember.id__');

      const finds = memberFinds(steps);

      expect(finds).toHaveLength(1);
      expect(finds[0].settings?.input?.filter).toEqual({});
      expect(
        buildCandidateSequencerGraph({ pinSenderByWarmOverlap: false }),
      ).toEqual(graph);
    });

    it('sends email from the pinned member mailbox only when on', () => {
      const emailSenders = (steps: unknown[]) =>
        (
          steps as Array<{
            type: string;
            settings?: { input?: { connectedAccountId?: string } };
          }>
        )
          .filter((step) => step.type === 'SEND_EMAIL')
          .map((step) => step.settings?.input?.connectedAccountId);

      const off = emailSenders(buildCandidateSequencerGraph().steps);
      const on = emailSenders(
        buildCandidateSequencerGraph({
          pinSenderByWarmOverlap: true,
          emailConnected: true,
        }).steps,
      );

      expect(off.every((sender) => sender === '')).toBe(true);
      expect(on.length).toBeGreaterThan(0);
      expect(
        on.every((sender) => typeof sender === 'string' && sender.includes('.first.id')),
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
});
