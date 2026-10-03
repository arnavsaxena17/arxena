import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';

// Shape expected by the candidate drawer (CandidateChatDrawer and its
// header) and the Cmd+K record actions, which read the selected
// row from searchResultsState.
export const mapOutreachPersonToTableRow = (
  person: OutreachPersonRow,
  projectId: string | null | undefined,
): Record<string, unknown> => {
  const nameParts = person.name.trim().split(/\s+/);
  const linkedinUrl = person.linkedinUrl.startsWith('http')
    ? person.linkedinUrl
    : person.linkedinUrl
      ? `https://${person.linkedinUrl}`
      : '';

  return {
    id: person.id,
    tempId: person.id,
    __isFetched: true,
    isOutreachHomeRow: true,
    outreachProjectId: projectId ?? '',
    fullName: person.name,
    name: person.name,
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' '),
    jobTitle: person.title,
    // LinkedIn headline ≠ job title; only show when we actually have it
    headline: person.headline ?? '',
    // LinkedIn About section — distinct from headline and title
    summary: person.summary ?? '',
    company: person.companyName,
    jobCompanyName: person.companyName,
    location: person.locationName ?? '',
    locationName: person.locationName ?? '',
    linkedinUrl: { primaryLinkUrl: linkedinUrl },
    phoneNumber: { primaryPhoneNumber: '' },
    email: { primaryEmail: person.email || '' },
    outreachSequenceStage: person.stage,
    outreachConversationStage: person.outreachConversationStage ?? 'NONE',
    workflowRunStatus: person.workflowRunStatus ?? '',
    nextStep: person.nextStepLabel ?? '',
    nextRetry: person.nextRetryAt ?? '',
    needsApproval: person.needsApproval === true,
    replyAfterTouch: person.replyAfterTouch ?? '',
    lastMessage: person.lastInboundCopy ?? '',
    lastInboundAt: person.lastInboundAt ?? '',
    lastOutboundAt: person.lastOutboundAt ?? '',
    nextFollowUp: person.outreachResumeAt ?? '',
    startOutreach: person.candidateFlags?.startOutreach === true,
    stopOutreach: person.candidateFlags?.stopOutreach === true,
    candidateFlags: {
      engagementStatus: Boolean(person.stage),
      startChat: false,
      stopChat: false,
      startOutreach: person.candidateFlags?.startOutreach === true,
      stopOutreach: person.candidateFlags?.stopOutreach === true,
    },
    chatMessages: { edges: [] },
    emailMessages: { edges: [] },
    otherFields: {
      warmPath: person.warmPath,
      companyId: person.companyId,
      candidateId: person.candidateId,
      openOutreachJourneyTab: true,
      pendingChannel: person.pendingChannel ?? '',
      connectionDegree: person.connectionDegree ?? null,
      personaPriorityScore: person.personaPriorityScore ?? null,
      ...(person.experimentVariant
        ? { experimentVariant: person.experimentVariant }
        : {}),
    },
    uniqueStringKey: person.id,
    peopleId: person.id,
    personId: person.id,
    candidateId: person.candidateId,
    updatedAt: person.updatedAt ?? '',
    createdAt: person.createdAt ?? '',
    messagesExchanged: person.messagesExchanged ?? '',
  };
};
