import { WorkflowSendEmailAttachments } from '@/advanced-text-editor/components/WorkflowSendEmailAttachments';
import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowSendLinkedinMessageAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { type WorkflowEmailFiles } from 'twenty-shared/workflow';

type FormData = {
  workspaceMemberId: string;
  linkedinProfileId: string;
  linkedinUrl: string;
  body: string;
  files: WorkflowEmailFiles;
};

type WorkflowEditActionSendLinkedinMessageProps = {
  action: WorkflowSendLinkedinMessageAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowSendLinkedinMessageAction) => void;
      };
};

export const WorkflowEditActionSendLinkedinMessage = ({
  action,
  actionOptions,
}: WorkflowEditActionSendLinkedinMessageProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      linkedinProfileId: action.settings.input.linkedinProfileId,
      linkedinUrl: action.settings.input.linkedinUrl ?? '',
      body: action.settings.input.body ?? '',
      files: action.settings.input.files ?? [],
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
          label={t`Body`}
          placeholder={t`Message body`}
          multiline
          readonly={actionOptions.readonly}
          defaultValue={formData.body}
          onChange={(value) => handleFieldChange('body', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <WorkflowSendEmailAttachments
          label={t`Attachments`}
          files={formData.files}
          readonly={actionOptions.readonly}
          onChange={(files) => {
            handleFieldChange('files', files);
          }}
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      {!actionOptions.readonly && <WorkflowStepFooter stepId={action.id} />}
    </>
  );
};
