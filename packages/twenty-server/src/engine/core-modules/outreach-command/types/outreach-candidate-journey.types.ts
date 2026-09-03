export type CandidateOutreachJourneyActiveRun = {
  workflowRunId: string;
  workflowName: string;
  status: string;
  currentStepName: string | null;
  currentStepKind: string | null;
  resumeAt: string | null;
  pendingReason: string | null;
  pendingStepId: string | null;
  pendingFormStepId: string | null;
  draftPreview: string | null;
  upcomingSteps: string | null;
};

export type CandidateOutreachJourneyStageHistoryEntry = {
  stage: string;
  at: string;
};

export type CandidateOutreachJourney = {
  candidateId: string;
  projectId: string;
  outreachSequenceStage: string;
  outreachConversationStage: string;
  linkedinFollowUpCount: number;
  pendingChannel: string | null;
  outreachResumeAt: string | null;
  outreachPaused: boolean;
  activeRuns: CandidateOutreachJourneyActiveRun[];
  stageHistory: CandidateOutreachJourneyStageHistoryEntry[];
};

export type OutreachProjectJourneySummary = {
  totalEnrolled: number;
  byStage: Record<string, number>;
  byConversationStage: Record<string, number>;
  needsApproval: number;
  dueThisWeek: number;
  snoozed: number;
  byCandidateId: Record<string, OutreachCandidateRunSummary>;
};

export type OutreachCandidateRunSummary = {
  status: string | null;
  currentStepName: string | null;
  currentStepKind: string | null;
  resumeAt: string | null;
  pendingReason: string | null;
  needsApproval: boolean;
};
