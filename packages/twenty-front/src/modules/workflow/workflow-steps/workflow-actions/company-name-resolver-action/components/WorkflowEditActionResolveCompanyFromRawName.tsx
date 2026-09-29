import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowResolveCompanyFromRawNameAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';

type FormData = {
  companyName: string;
  companyNamesCsv: string;
};

type WorkflowEditActionResolveCompanyFromRawNameProps = {
  action: WorkflowResolveCompanyFromRawNameAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (
          action: WorkflowResolveCompanyFromRawNameAction,
        ) => void;
      };
};

export const WorkflowEditActionResolveCompanyFromRawName = ({
  action,
  actionOptions,
}: WorkflowEditActionResolveCompanyFromRawNameProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      companyName: action.settings.input.companyName ?? '',
      companyNamesCsv: (action.settings.input.companyNames ?? []).join(', '),
    },
    readonly: actionOptions.readonly === true,
    onSave: (nextFormData: FormData) => {
      if (actionOptions.readonly === true) {
        return;
      }

      const companyNames = nextFormData.companyNamesCsv
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: {
            ...action.settings.input,
            companyName: nextFormData.companyName,
            companyNames,
          },
        },
      });
    },
  });

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  return (
    <>
      <WorkflowStepBody>
        <FormTextFieldInput
          label={t`Company name`}
          placeholder={t`Larsen & Toubro (L&T)`}
          readonly={actionOptions.readonly}
          defaultValue={formData.companyName}
          onChange={(value) => handleFieldChange('companyName', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Company names (comma-separated)`}
          placeholder={t`Torrent Power, Nestle India Ltd`}
          readonly={actionOptions.readonly}
          defaultValue={formData.companyNamesCsv}
          onChange={(value) => handleFieldChange('companyNamesCsv', value)}
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      <WorkflowStepFooter stepId={action.id} />
    </>
  );
};
