import { type WorkflowFormFieldType } from 'src/modules/workflow/workflow-executor/workflow-actions/form/types/workflow-form-field-type.type';
import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

export type FormFieldMetadata = {
  id: string;
  name: string;
  label: string;
  type: WorkflowFormFieldType;
  // oxlint-disable-next-line typescript/no-explicit-any
  value?: any;
  placeholder?: string;
  // oxlint-disable-next-line typescript/no-explicit-any
  settings?: Record<string, any>;
};

export type WorkflowFormNotifyOnPending = {
  channels: string[];
  // WhatsApp {{1}} — backdrop / purpose (supports workflow variables)
  contextTemplate: string;
  // WhatsApp {{2}} — extra details / variables (optional; else field labels)
  detailsTemplate?: string;
  whatsappOfficialRegistryName?: string;
  recipients?: {
    WHATSAPP_OFFICIAL?: string;
    WHATSAPP_UNIPILE?: string;
    unipileAccountId?: string;
  };
};

export type WorkflowFormActionSettings = BaseWorkflowActionSettings & {
  input: FormFieldMetadata[];
  notifyOnPending?: WorkflowFormNotifyOnPending;
};
