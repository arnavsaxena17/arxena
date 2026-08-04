import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowSendLinkedinInmailAction } from '@/workflow/types/Workflow';
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
  subject: string;
  body: string;
};

type WorkflowEditActionSendLinkedinInmailProps = {
  action: WorkflowSendLinkedinInmailAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowSendLinkedinInmailAction) => void;
      };
};

export const WorkflowEditActionSendLinkedinInmail = ({
  action,
  actionOptions,
}: WorkflowEditActionSendLinkedinInmailProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      linkedinProfileId: action.settings.input.linkedinProfileId,
      subject: action.settings.input.subject ?? '',
      body: action.settings.input.body ?? '',
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
          input: nextFormData,
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
          label={t`LinkedIn profile`}
          placeholder={t`Profile ID, public identifier, or LinkedIn URL`}
          readonly={actionOptions.readonly}
          defaultValue={formData.linkedinProfileId}
          onChange={(value) => handleFieldChange('linkedinProfileId', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Subject`}
          placeholder={t`InMail subject`}
          readonly={actionOptions.readonly}
          defaultValue={formData.subject}
          onChange={(value) => handleFieldChange('subject', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Body`}
          placeholder={t`InMail body`}
          multiline
          readonly={actionOptions.readonly}
          defaultValue={formData.body}
          onChange={(value) => handleFieldChange('body', value)}
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      {!actionOptions.readonly && <WorkflowStepFooter stepId={action.id} />}
    </>
  );
};
