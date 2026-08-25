import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowSendLinkedinConnectionRequestAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';

type FormData = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  linkedinUrl: string;
  message: string;
};

type WorkflowEditActionSendLinkedinConnectionRequestProps = {
  action: WorkflowSendLinkedinConnectionRequestAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (
          action: WorkflowSendLinkedinConnectionRequestAction,
        ) => void;
      };
};

export const WorkflowEditActionSendLinkedinConnectionRequest = ({
  action,
  actionOptions,
}: WorkflowEditActionSendLinkedinConnectionRequestProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      linkedinProfileId: action.settings.input.linkedinProfileId,
      linkedinUrl: action.settings.input.linkedinUrl ?? '',
      message: action.settings.input.message ?? '',
    },
    readonly: actionOptions.readonly === true,
    onSave: (nextFormData: FormData) => {
      if (actionOptions.readonly === true) {
        return;
      }

      actionOptions.onActionUpdate({
        ...action,
        settings: {
          ...action.settings,
          input: {
            ...action.settings.input,
            ...nextFormData,
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
        <FormSingleRecordPicker
          label={t`Send as`}
          defaultValue={formData.workspaceMemberId || null}
          onChange={(value) =>
            handleFieldChange('workspaceMemberId', value ?? '')
          }
          objectNameSingulars={[CoreObjectNameSingular.WorkspaceMember]}
          disabled={actionOptions.readonly}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`LinkedIn profile ID`}
          placeholder={t`muizesmail, ACoAA…, or https://linkedin.com/in/muizesmail`}
          readonly={actionOptions.readonly}
          defaultValue={formData.linkedinProfileId}
          onChange={(value) => handleFieldChange('linkedinProfileId', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`LinkedIn URL`}
          placeholder={t`Optional. Person/Candidate LinkedIn URL if profile ID is empty`}
          readonly={actionOptions.readonly}
          defaultValue={formData.linkedinUrl}
          onChange={(value) => handleFieldChange('linkedinUrl', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Message`}
          placeholder={t`Optional connection note (max 300 characters)`}
          multiline
          readonly={actionOptions.readonly}
          defaultValue={formData.message}
          onChange={(value) => handleFieldChange('message', value)}
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      {!actionOptions.readonly && <WorkflowStepFooter stepId={action.id} />}
    </>
  );
};
