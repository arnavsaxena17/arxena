import { isDefined } from 'twenty-shared/utils';

import {
  buildCandidateSequencerGraph,
  type OutreachSequencerGraphOptions,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graphs';
import {
  OUTREACH_WF_AGENT_EMAIL,
  OUTREACH_WF_AGENT_EXTRACT,
  OUTREACH_WF_AGENT_LINKEDIN,
  OUTREACH_WF_AGENT_QUALIFY,
  OUTREACH_WF_AGENT_REPLY,
  OUTREACH_WF_FIELD,
  OUTREACH_WF_HARVEST_PROJECT_ID,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/data/outreach-workflow-graph-helpers';
import { getOutreachLogicFunctionIds } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';
import {
  getOutreachAgentIds,
  getOutreachHarvestProjectId,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

const LF_TOKEN_TO_ID_KEY = {
  '__LF_search-people-for-company__': 'searchPeopleForCompanyId',
  '__LF_upload-profiles__': 'uploadProfilesId',
  '__LF_search-companies__': 'searchCompaniesId',
  '__LF_upsert-companies__': 'upsertCompaniesId',
  '__LF_enrich-contact__': 'enrichContactId',
  '__LF_get-calendar-availability__': 'getCalendarAvailabilityId',
  '__LF_fetch-linkedin-messages__': 'fetchLinkedinMessagesId',
  '__LF_fetch-linkedin-profile__': 'fetchLinkedinProfileId',
  '__LF_validate-inbound-signals__': 'validateInboundSignalsId',
} as const;

export const substituteOutreachWorkflowTokens = (
  value: unknown,
  replacements: Record<string, string>,
): unknown => {
  let serialized = JSON.stringify(value);

  for (const [token, replacement] of Object.entries(replacements)) {
    serialized = serialized.split(token).join(replacement);
  }

  if (
    serialized.includes('__LF_') ||
    serialized.includes('__AGENT_') ||
    serialized.includes('__PROJECT_') ||
    serialized.includes('__FIELD_')
  ) {
    throw new Error('Unresolved GTM outreach workflow token');
  }

  return JSON.parse(serialized);
};

export const buildSubstitutedCandidateSequencerGraph = ({
  workspaceId,
  fieldMetadataIds,
  options,
}: {
  workspaceId: string;
  fieldMetadataIds: {
    candidateId: string;
    outreachSequenceStage: string;
    candidateFlags: string;
    jobCompanyName: string;
    projectId: string;
    createdAt: string;
    chatCandidateId: string;
    chatCreatedAt: string;
  };
  options: OutreachSequencerGraphOptions;
}): {
  trigger: Record<string, unknown>;
  steps: unknown[];
} => {
  const agentIds = getOutreachAgentIds(workspaceId);
  const lfIds = getOutreachLogicFunctionIds(workspaceId);
  const harvestProjectId = getOutreachHarvestProjectId(workspaceId);

  const replacements: Record<string, string> = {
    [OUTREACH_WF_AGENT_LINKEDIN]: agentIds.linkedinMessage,
    [OUTREACH_WF_AGENT_EMAIL]: agentIds.fallbackEmail,
    [OUTREACH_WF_AGENT_REPLY]: agentIds.reply,
    [OUTREACH_WF_AGENT_EXTRACT]: agentIds.extractSignals,
    [OUTREACH_WF_AGENT_QUALIFY]: agentIds.qualifyProspect,
    [OUTREACH_WF_HARVEST_PROJECT_ID]: harvestProjectId,
    [OUTREACH_WF_FIELD.candidateId]: fieldMetadataIds.candidateId,
    [OUTREACH_WF_FIELD.outreachSequenceStage]:
      fieldMetadataIds.outreachSequenceStage,
    [OUTREACH_WF_FIELD.candidateFlags]: fieldMetadataIds.candidateFlags,
    [OUTREACH_WF_FIELD.jobCompanyName]: fieldMetadataIds.jobCompanyName,
    [OUTREACH_WF_FIELD.projectId]: fieldMetadataIds.projectId,
    [OUTREACH_WF_FIELD.createdAt]: fieldMetadataIds.createdAt,
    [OUTREACH_WF_FIELD.chatCandidateId]: fieldMetadataIds.chatCandidateId,
    [OUTREACH_WF_FIELD.chatCreatedAt]: fieldMetadataIds.chatCreatedAt,
  };

  for (const [token, idKey] of Object.entries(LF_TOKEN_TO_ID_KEY)) {
    const logicFunctionId = lfIds[idKey as keyof typeof lfIds];

    if (!isDefined(logicFunctionId)) {
      throw new Error(`Missing outreach logic function id for ${token}`);
    }

    replacements[token] = logicFunctionId;
  }

  const graph = buildCandidateSequencerGraph(options);

  return {
    trigger: substituteOutreachWorkflowTokens(
      graph.trigger,
      replacements,
    ) as Record<string, unknown>,
    steps: substituteOutreachWorkflowTokens(
      graph.steps,
      replacements,
    ) as unknown[],
  };
};
