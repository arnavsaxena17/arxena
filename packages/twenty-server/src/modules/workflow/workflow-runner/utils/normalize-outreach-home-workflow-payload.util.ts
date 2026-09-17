import { isPlainObject, isValidUuid } from 'twenty-shared/utils';

// Outreach People HotTable rows use person/working-set id as `id` and stash the
// real CRM candidate under `candidateId`. Manual Candidate Sequencer runs must
// bind workflowRun.candidateId (and step {{trigger.id}}) to the CRM candidate.
export const normalizeOutreachHomeWorkflowPayload = (
  payload: object,
): object => {
  if (!isPlainObject(payload)) {
    return payload;
  }

  if (isPlainObject(payload.payload)) {
    return {
      ...payload,
      payload: normalizeOutreachHomeWorkflowPayload(payload.payload),
    };
  }

  if (payload.isOutreachHomeRow !== true) {
    return payload;
  }

  const candidateId = payload.candidateId;

  if (typeof candidateId !== 'string' || !isValidUuid(candidateId)) {
    return payload;
  }

  if (payload.id === candidateId) {
    return payload;
  }

  return {
    ...payload,
    id: candidateId,
  };
};
