import { type WorkflowStep } from '@/workflow/types/Workflow';
import { getWorkflowVariablesUsedInStep } from '@/workflow/workflow-steps/utils/getWorkflowVariablesUsedInStep';
import { type WorkflowFormActionField } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormActionField';

export type WorkflowFormNotifyOnPendingSettings = {
  channels: string[];
  contextTemplate: string;
  detailsTemplate?: string;
  whatsappOfficialRegistryName?: string;
  recipients?: {
    WHATSAPP_OFFICIAL?: string;
    WHATSAPP_UNIPILE?: string;
    unipileAccountId?: string;
  };
};

export const getWorkflowFormNotifyVariablesUsed = ({
  fields,
  notifyOnPending,
}: {
  fields: WorkflowFormActionField[];
  notifyOnPending?: WorkflowFormNotifyOnPendingSettings;
}): string[] => {
  const mockStep = {
    id: 'test-step',
    name: 'Test Step',
    type: 'FORM',
    valid: true,
    settings: {
      input: {
        fields,
        notifyOnPending: notifyOnPending ?? {},
      },
      outputSchema: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
    },
  } as unknown as WorkflowStep;

  return Array.from(getWorkflowVariablesUsedInStep({ step: mockStep }));
};
