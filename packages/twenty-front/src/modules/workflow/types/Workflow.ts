import { StepFilter, StepFilterGroup, StepIfElseBranch } from 'twenty-shared';

type BaseWorkflowActionSettings = {
  input: object;
  outputSchema: object;
  errorHandlingOptions: {
    retryOnFailure: {
      value: boolean;
    };
    continueOnFailure: {
      value: boolean;
    };
  };
};

export type WorkflowCodeActionSettings = BaseWorkflowActionSettings & {
  input: {
    serverlessFunctionId: string;
    serverlessFunctionVersion: string;
    serverlessFunctionInput: {
      [key: string]: any;
    };
  };
};

export type WorkflowSendEmailActionSettings = BaseWorkflowActionSettings & {
  input: {
    connectedAccountId: string;
    email: string;
    subject?: string;
    body?: string;
  };
};

type ObjectRecord = Record<string, any>;

export type WorkflowCreateRecordActionSettings = BaseWorkflowActionSettings & {
  input: {
    objectName: string;
    objectRecord: ObjectRecord;
  };
};

export type WorkflowUpdateRecordActionSettings = BaseWorkflowActionSettings & {
  input: {
    objectName: string;
    objectRecord: ObjectRecord;
    objectRecordId: string;
    fieldsToUpdate: string[];
  };
};

export type WorkflowDeleteRecordActionSettings = BaseWorkflowActionSettings & {
  input: {
    objectName: string;
    objectRecordId: string;
  };
};

export type WorkflowFindRecordsActionSettings = BaseWorkflowActionSettings & {
  input: {
    objectName: string;
    limit?: number;
  };
};

export type WorkflowStepFilter = StepFilter & {
  label?: string;
  displayValue?: string;
};

export type WorkflowStepFilterGroup = StepFilterGroup;

export type WorkflowFilterActionSettings = BaseWorkflowActionSettings & {
  input: {
    stepFilterGroups?: WorkflowStepFilterGroup[];
    stepFilters?: WorkflowStepFilter[];
  };
};

export type WorkflowIfElseBranch = StepIfElseBranch;

export type WorkflowIfElseActionSettings = BaseWorkflowActionSettings & {
  input: {
    stepFilterGroups: WorkflowStepFilterGroup[];
    stepFilters: WorkflowStepFilter[];
    branches: WorkflowIfElseBranch[];
  };
};

export type WorkflowIteratorActionSettings = BaseWorkflowActionSettings & {
  input: {
    items?: unknown[] | string;
    initialLoopStepIds?: string[];
    shouldContinueOnIterationFailure?: boolean;
  };
};

export type WorkflowAiAgentActionSettings = BaseWorkflowActionSettings & {
  input: {
    agentId?: string;
    prompt?: string;
    systemPrompt?: string;
  };
};

export type WorkflowDelayActionSettings = BaseWorkflowActionSettings & {
  input:
    | {
        delayType: 'DURATION';
        duration: {
          days?: number;
          hours?: number;
          minutes?: number;
          seconds?: number;
        };
      }
    | {
        delayType: 'SCHEDULED_DATE';
        scheduledDateTime: string;
      };
};

type BaseWorkflowAction = {
  id: string;
  name: string;
  valid: boolean;
  nextStepIds?: string[];
  position?: { x: number; y: number };
};

export type WorkflowCodeAction = BaseWorkflowAction & {
  type: 'CODE';
  settings: WorkflowCodeActionSettings;
};

export type WorkflowSendEmailAction = BaseWorkflowAction & {
  type: 'SEND_EMAIL';
  settings: WorkflowSendEmailActionSettings;
};

export type WorkflowCreateRecordAction = BaseWorkflowAction & {
  type: 'CREATE_RECORD';
  settings: WorkflowCreateRecordActionSettings;
};

export type WorkflowUpdateRecordAction = BaseWorkflowAction & {
  type: 'UPDATE_RECORD';
  settings: WorkflowUpdateRecordActionSettings;
};

export type WorkflowDeleteRecordAction = BaseWorkflowAction & {
  type: 'DELETE_RECORD';
  settings: WorkflowDeleteRecordActionSettings;
};

export type WorkflowFindRecordsAction = BaseWorkflowAction & {
  type: 'FIND_RECORDS';
  settings: WorkflowFindRecordsActionSettings;
};

export type WorkflowFilterAction = BaseWorkflowAction & {
  type: 'FILTER';
  settings: WorkflowFilterActionSettings;
};

export type WorkflowIfElseAction = BaseWorkflowAction & {
  type: 'IF_ELSE';
  settings: WorkflowIfElseActionSettings;
};

export type WorkflowIteratorAction = BaseWorkflowAction & {
  type: 'ITERATOR';
  settings: WorkflowIteratorActionSettings;
};

export type WorkflowAiAgentAction = BaseWorkflowAction & {
  type: 'AI_AGENT';
  settings: WorkflowAiAgentActionSettings;
};

export type WorkflowDelayAction = BaseWorkflowAction & {
  type: 'DELAY';
  settings: WorkflowDelayActionSettings;
};

export type WorkflowEmptyAction = BaseWorkflowAction & {
  type: 'EMPTY';
  settings: BaseWorkflowActionSettings;
};

export type WorkflowAction =
  | WorkflowCodeAction
  | WorkflowSendEmailAction
  | WorkflowCreateRecordAction
  | WorkflowUpdateRecordAction
  | WorkflowDeleteRecordAction
  | WorkflowFindRecordsAction
  | WorkflowFilterAction
  | WorkflowIfElseAction
  | WorkflowIteratorAction
  | WorkflowAiAgentAction
  | WorkflowDelayAction
  | WorkflowEmptyAction;

export type WorkflowActionType = WorkflowAction['type'];

export type WorkflowStep = WorkflowAction;

export type WorkflowStepType = WorkflowStep['type'];

type BaseTrigger = {
  name?: string;
  type: string;
  nextStepIds?: string[];
  position?: { x: number; y: number };
};

export type WorkflowDatabaseEventTrigger = BaseTrigger & {
  type: 'DATABASE_EVENT';
  settings: {
    eventName: string;
    input?: object;
    outputSchema: object;
    objectType?: string;
  };
};

export type WorkflowManualTrigger = BaseTrigger & {
  type: 'MANUAL';
  settings: {
    objectType?: string;
    outputSchema: object;
  };
};

export type WorkflowCronTrigger = BaseTrigger & {
  type: 'CRON';
  settings: (
    | {
        type: 'HOURS';
        schedule: { hour: number; minute: number };
      }
    | {
        type: 'MINUTES';
        schedule: { minute: number };
      }
    | {
        type: 'CUSTOM';
        pattern: string;
      }
  ) & { outputSchema: object };
};

export type WorkflowManualTriggerSettings = WorkflowManualTrigger['settings'];

export type WorkflowManualTriggerAvailability =
  | 'EVERYWHERE'
  | 'WHEN_RECORD_SELECTED';

export type WorkflowTrigger =
  | WorkflowDatabaseEventTrigger
  | WorkflowManualTrigger
  | WorkflowCronTrigger;

export type WorkflowTriggerType = WorkflowTrigger['type'];

export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'DEACTIVATED';

export type WorkflowVersionStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'DEACTIVATED'
  | 'ARCHIVED';

export type WorkflowVersion = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workflowId: string;
  trigger: WorkflowTrigger | null;
  steps: Array<WorkflowStep> | null;
  status: WorkflowVersionStatus;
  __typename: 'WorkflowVersion';
};

type StepRunOutput = {
  id: string;
  outputs: {
    attemptCount: number;
    result: object | undefined;
    error: string | undefined;
  }[];
};

export type WorkflowRunOutputStepsOutput = Record<string, StepRunOutput>;

export type WorkflowRunOutput = {
  flow: {
    trigger: WorkflowTrigger;
    steps: WorkflowAction[];
  };
  stepsOutput?: WorkflowRunOutputStepsOutput;
  error?: string;
};

export type WorkflowRunStepStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'PENDING'
  | 'STOPPED';

export type WorkflowRunStepInfo = {
  status: WorkflowRunStepStatus;
  result?: unknown;
  error?: string;
};

export type WorkflowRunStepInfos = Record<string, WorkflowRunStepInfo>;

export type WorkflowRunState = {
  flow: {
    trigger: WorkflowTrigger;
    steps: WorkflowAction[];
  };
  stepInfos: WorkflowRunStepInfos;
  workflowRunError?: string;
};

export type WorkflowRun = {
  __typename: 'WorkflowRun';
  id: string;
  workflowVersionId: string;
  output: WorkflowRunOutput | null;
  state?: WorkflowRunState | null;
};

export type Workflow = {
  __typename: 'Workflow';
  id: string;
  name: string;
  versions: Array<WorkflowVersion>;
  lastPublishedVersionId: string;
  statuses: Array<WorkflowStatus> | null;
};

export type WorkflowWithCurrentVersion = Workflow & {
  currentVersion: WorkflowVersion;
};
