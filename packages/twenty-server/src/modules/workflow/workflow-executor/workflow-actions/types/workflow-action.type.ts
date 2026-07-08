import { WorkflowActionType } from 'twenty-shared';

import { WorkflowAiAgentActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/types/workflow-ai-agent-action-settings.type';
import { WorkflowCodeActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/code/types/workflow-code-action-settings.type';
import { WorkflowDelayActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/workflow-delay-action-settings.type';
import { WorkflowFilterActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/filter/types/workflow-filter-action-settings.type';
import { WorkflowIfElseActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/if-else/types/workflow-if-else-action-settings.type';
import { WorkflowIteratorActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/iterator/types/workflow-iterator-action-settings.type';
import { WorkflowSendEmailActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/mail-sender/types/workflow-send-email-action-settings.type';
import {
  WorkflowCreateRecordActionSettings,
  WorkflowDeleteRecordActionSettings,
  WorkflowFindRecordsActionSettings,
  WorkflowUpdateRecordActionSettings,
} from 'src/modules/workflow/workflow-executor/workflow-actions/record-crud/types/workflow-record-crud-action-settings.type';
import { WorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

export { WorkflowActionType };

type BaseWorkflowAction = {
  id: string;
  name: string;
  type: WorkflowActionType;
  settings: WorkflowActionSettings;
  valid: boolean;
  nextStepIds?: string[];
  position?: {
    x: number;
    y: number;
  };
};

export type WorkflowCodeAction = BaseWorkflowAction & {
  type: WorkflowActionType.CODE;
  settings: WorkflowCodeActionSettings;
};

export type WorkflowSendEmailAction = BaseWorkflowAction & {
  type: WorkflowActionType.SEND_EMAIL;
  settings: WorkflowSendEmailActionSettings;
};

export type WorkflowCreateRecordAction = BaseWorkflowAction & {
  type: WorkflowActionType.CREATE_RECORD;
  settings: WorkflowCreateRecordActionSettings;
};

export type WorkflowUpdateRecordAction = BaseWorkflowAction & {
  type: WorkflowActionType.UPDATE_RECORD;
  settings: WorkflowUpdateRecordActionSettings;
};

export type WorkflowDeleteRecordAction = BaseWorkflowAction & {
  type: WorkflowActionType.DELETE_RECORD;
  settings: WorkflowDeleteRecordActionSettings;
};

export type WorkflowFindRecordsAction = BaseWorkflowAction & {
  type: WorkflowActionType.FIND_RECORDS;
  settings: WorkflowFindRecordsActionSettings;
};

export type WorkflowFilterAction = BaseWorkflowAction & {
  type: WorkflowActionType.FILTER;
  settings: WorkflowFilterActionSettings;
};

export type WorkflowIfElseAction = BaseWorkflowAction & {
  type: WorkflowActionType.IF_ELSE;
  settings: WorkflowIfElseActionSettings;
};

export type WorkflowIteratorAction = BaseWorkflowAction & {
  type: WorkflowActionType.ITERATOR;
  settings: WorkflowIteratorActionSettings;
};

export type WorkflowAiAgentAction = BaseWorkflowAction & {
  type: WorkflowActionType.AI_AGENT;
  settings: WorkflowAiAgentActionSettings;
};

export type WorkflowDelayAction = BaseWorkflowAction & {
  type: WorkflowActionType.DELAY;
  settings: WorkflowDelayActionSettings;
};

export type WorkflowEmptyAction = BaseWorkflowAction & {
  type: WorkflowActionType.EMPTY;
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
