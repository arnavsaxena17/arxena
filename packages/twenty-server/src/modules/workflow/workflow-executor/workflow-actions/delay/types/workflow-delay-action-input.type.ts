export type WorkflowDelayDuration = {
  days?: number | string;
  hours?: number | string;
  minutes?: number | string;
  seconds?: number | string;
};

export type WorkflowDelayActionInput =
  | WorkflowScheduledDateActionInput
  | WorkflowDurationDelayActionInput
  | WorkflowRandomDurationDelayActionInput;

export type WorkflowScheduledDateActionInput = {
  delayType: 'SCHEDULED_DATE';
  scheduledDateTime: string;
};

export type WorkflowDurationDelayActionInput = {
  delayType: 'DURATION';
  duration: WorkflowDelayDuration;
};

export type WorkflowRandomDurationDelayActionInput = {
  delayType: 'RANDOM_DURATION';
  minDuration: WorkflowDelayDuration;
  maxDuration: WorkflowDelayDuration;
};
