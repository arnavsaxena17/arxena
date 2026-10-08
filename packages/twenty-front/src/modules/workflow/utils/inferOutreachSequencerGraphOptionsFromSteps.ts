// Stable Candidate Sequencer step ids used to infer Edit Workflow toggles.
export const OUTREACH_SEQUENCER_INFERENCE_STEP_IDS = {
  draftConnectNote: 'c7a10010-aaaa-4fcb-a7d8-17a7736ed045',
  approveFirst: '4d4e9ac8-ecdd-4174-af3e-43b31971079b',
  approveReply: 'c83e4113-c3b9-4207-8baf-e311be592bf3',
  sendReplyWhatsapp: '51a10027-aaaa-4fcb-a7d8-17a7736ed045',
  sendReplyEmail: '51a10026-aaaa-4fcb-a7d8-17a7736ed045',
  meetingBookedFind: 'c7a10020-aaaa-4fcb-a7d8-17a7736ed045',
  hasCompanyIf: 'c7a10001-aaaa-4fcb-a7d8-17a7736ed045',
  qualifyDraft: 'c7a1000c-aaaa-4fcb-a7d8-17a7736ed045',
  viewBeforeComment: 'c7a10100-aaaa-4fcb-a7d8-17a7736ed045',
  fetchActivity2: 'c7a10109-aaaa-4fcb-a7d8-17a7736ed045',
  waitInboundInvite: 'c7a1010e-aaaa-4fcb-a7d8-17a7736ed045',
  sendInmail: 'c7a10302-aaaa-4fcb-a7d8-17a7736ed045',
  // Always present DELAY; 1-minute duration means testMode was applied.
  waitAccept: '67f433aa-9f97-4b87-aa9e-792d23839323',
} as const;

export type OutreachSequencerGraphOptions = {
  useLlmConnectionNote: boolean;
  humanInTheLoop: boolean;
  whatsappEnabled: boolean;
  emailConnected: boolean;
  meetingFollowUpEnabled: boolean;
  checkDeduplicationPerCompany: boolean;
  qualifyProspectEnabled: boolean;
  commentBeforeConnect: boolean;
  commentRounds: 1 | 2;
  inboundInviteWaitDays: number;
  inmailEnabled: boolean;
  testMode: boolean;
};

type InferableSequencerStep = {
  id?: string;
  type?: string;
  settings?: {
    input?: {
      duration?: {
        days?: number;
        hours?: number;
        minutes?: number;
        seconds?: number;
      };
    };
  };
};

export const inferOutreachSequencerGraphOptionsFromSteps = (
  steps: InferableSequencerStep[] | null | undefined,
  _trigger?: { type?: string } | null,
): OutreachSequencerGraphOptions => {
  const stepIds = new Set(
    (steps ?? [])
      .map((step) => step.id)
      .filter((stepId): stepId is string => typeof stepId === 'string'),
  );
  const waitAcceptStep = (steps ?? []).find(
    (step) => step.id === OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.waitAccept,
  );
  const waitAcceptDuration = waitAcceptStep?.settings?.input?.duration;
  const testMode =
    waitAcceptDuration?.minutes === 1 && (waitAcceptDuration.days ?? 0) === 0;
  const waitInboundStep = (steps ?? []).find(
    (step) =>
      step.id === OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.waitInboundInvite,
  );
  const inboundDays = waitInboundStep?.settings?.input?.duration?.days;

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
    // Disconnected email swaps SEND_EMAIL for a logic-function notice on the same id.
    emailConnected:
      (steps ?? []).find(
        (step) =>
          step.id === OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.sendReplyEmail,
      )?.type !== 'LOGIC_FUNCTION',
    meetingFollowUpEnabled: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.meetingBookedFind,
    ),
    checkDeduplicationPerCompany: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.hasCompanyIf,
    ),
    qualifyProspectEnabled: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.qualifyDraft,
    ),
    commentBeforeConnect: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.viewBeforeComment,
    ),
    commentRounds: stepIds.has(
      OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.fetchActivity2,
    )
      ? 2
      : 1,
    inboundInviteWaitDays:
      typeof inboundDays === 'number' && inboundDays > 0 ? inboundDays : 3,
    inmailEnabled: stepIds.has(OUTREACH_SEQUENCER_INFERENCE_STEP_IDS.sendInmail),
    testMode,
  };
};
