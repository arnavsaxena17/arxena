export type WorkflowAiFilteringRecord = Record<string, unknown> & {
  aiFilter: Record<string, unknown>;
};

export type WorkflowAiFilteringResult = {
  success: boolean;
  total: number;
  // Every record with its answers under aiFilter.
  candidates: WorkflowAiFilteringRecord[];
  // Records the filter accepted.
  kept?: WorkflowAiFilteringRecord[];
  // Records the filter answered "no" for, each with a reason.
  rejected?: Array<WorkflowAiFilteringRecord & { reason: string }>;
  // Records the model could not answer. Neither kept nor rejected: re-run them.
  failed?: Array<WorkflowAiFilteringRecord & { error: string }>;
  stats?: {
    engine: string;
    model: string;
    calls: number;
    retriedRecords: number;
    durationMs: number;
    kept: number;
    rejected: number;
    failed: number;
  };
  error?: string;
};
