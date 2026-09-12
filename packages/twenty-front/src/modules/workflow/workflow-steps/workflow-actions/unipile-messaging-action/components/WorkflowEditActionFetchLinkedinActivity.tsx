import { FormBooleanFieldInput } from '@/object-record/record-field/ui/form-types/components/FormBooleanFieldInput';
import { FormNumberFieldInput } from '@/object-record/record-field/ui/form-types/components/FormNumberFieldInput';
import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowFetchLinkedinActivityAction } from '@/workflow/types/Workflow';
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
  postsLimit: number;
  includeUserComments: boolean;
  userCommentsLimit: number;
};

type WorkflowEditActionFetchLinkedinActivityProps = {
  action: WorkflowFetchLinkedinActivityAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowFetchLinkedinActivityAction) => void;
      };
};

export const WorkflowEditActionFetchLinkedinActivity = ({
  action,
  actionOptions,
}: WorkflowEditActionFetchLinkedinActivityProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      linkedinProfileId: action.settings.input.linkedinProfileId,
      linkedinUrl: action.settings.input.linkedinUrl ?? '',
      postsLimit: action.settings.input.postsLimit ?? 10,
      includeUserComments: action.settings.input.includeUserComments !== false,
      userCommentsLimit: action.settings.input.userCommentsLimit ?? 10,
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
          label={t`Fetch as`}
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
        <FormNumberFieldInput
          label={t`Posts limit`}
          placeholder="10"
          readonly={actionOptions.readonly}
          defaultValue={formData.postsLimit}
          onChange={(value) =>
            handleFieldChange(
              'postsLimit',
              typeof value === 'number' ? value : 10,
            )
          }
          VariablePicker={WorkflowVariablePicker}
        />
        <FormBooleanFieldInput
          label={t`Include user comments`}
          defaultValue={formData.includeUserComments}
          onChange={(value) =>
            handleFieldChange('includeUserComments', value === true)
          }
          readonly={actionOptions.readonly}
        />
        <FormNumberFieldInput
          label={t`User comments limit`}
          placeholder="10"
          readonly={actionOptions.readonly}
          defaultValue={formData.userCommentsLimit}
          onChange={(value) =>
            handleFieldChange(
              'userCommentsLimit',
              typeof value === 'number' ? value : 10,
            )
          }
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      {!actionOptions.readonly && <WorkflowStepFooter stepId={action.id} />}
    </>
  );
};
