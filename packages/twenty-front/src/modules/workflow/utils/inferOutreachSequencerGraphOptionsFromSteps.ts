// Stable Candidate Sequencer step ids used to infer Edit Workflow toggles.
export const OUTREACH_SEQUENCER_INFERENCE_STEP_IDS = {
  draftConnectNote: 'c7a10010-aaaa-4fcb-a7d8-17a7736ed045',
  approveFirst: '4d4e9ac8-ecdd-4174-af3e-43b31971079b',
  approveReply: 'c83e4113-c3b9-4207-8baf-e311be592bf3',
  sendReplyWhatsapp: '51a10027-aaaa-4fcb-a7d8-17a7736ed045',
  meetingBookedFind: 'c7a10020-aaaa-4fcb-a7d8-17a7736ed045',
  hasCompanyIf: 'c7a10001-aaaa-4fcb-a7d8-17a7736ed045',
  qualifyDraft: 'c7a1000c-aaaa-4fcb-a7d8-17a7736ed045',
} as const;

export type OutreachSequencerGraphOptions = {
  useLlmConnectionNote: boolean;
  humanInTheLoop: boolean;
  whatsappEnabled: boolean;
  meetingFollowUpEnabled: boolean;
  checkDeduplicationPerCompany: boolean;
  qualifyProspectEnabled: boolean;
};

export const inferOutreachSequencerGraphOptionsFromSteps = (
  steps: Array<{ id?: string }> | null | undefined,
  _trigger?: { type?: string } | null,
): OutreachSequencerGraphOptions => {
  const stepIds = new Set(
    (steps ?? [])
      .map((step) => step.id)
      .filter((stepId): stepId is string => typeof stepId === 'string'),
  );

  return {
    useLlmConnectionNote: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.draftConnectNote,
    ),
    humanInTheLoop:
      stepIds.has(OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.approveFirst) ||
      stepIds.has(OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.approveReply),
    whatsappEnabled: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.sendReplyWhatsapp,
    ),
    meetingFollowUpEnabled: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.meetingBookedFind,
    ),
    checkDeduplicationPerCompany: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.hasCompanyIf,
    ),
    qualifyProspectEnabled: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.qualifyDraft,
    ),
  };
};
