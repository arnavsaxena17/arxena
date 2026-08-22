export type WorkflowActionOutput = {
  result?: object;
  error?: string;
  pendingEvent?: boolean;
  waitMs?: number;
  scheduledAt?: string;
  pendingReason?: string;
  shouldEndWorkflowRun?: boolean;
  shouldRemainRunning?: boolean;
  shouldSkipStepExecution?: boolean;
  shouldFailSafely?: boolean;
};
