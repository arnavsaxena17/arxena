import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowCommentOnLinkedinPostAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepFooter } from '@/workflow/workflow-steps/components/WorkflowStepFooter';
import { useUnipileMessagingForm } from '@/workflow/workflow-steps/workflow-actions/unipile-messaging-action/hooks/useUnipileMessagingForm';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { t } from '@lingui/core/macro';
import { useEffect } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';

type FormData = {
  workspaceMemberId: string;
  postId: string;
  text: string;
  commentId: string;
};

type WorkflowEditActionCommentOnLinkedinPostProps = {
  action: WorkflowCommentOnLinkedinPostAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowCommentOnLinkedinPostAction) => void;
      };
};

export const WorkflowEditActionCommentOnLinkedinPost = ({
  action,
  actionOptions,
}: WorkflowEditActionCommentOnLinkedinPostProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      postId: action.settings.input.postId,
      text: action.settings.input.text,
      commentId: action.settings.input.commentId ?? '',
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
          label={t`Comment as`}
          defaultValue={formData.workspaceMemberId || null}
          onChange={(value) =>
            handleFieldChange('workspaceMemberId', value ?? '')
          }
          objectNameSingulars={[CoreObjectNameSingular.WorkspaceMember]}
          disabled={actionOptions.readonly}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Post social ID`}
          placeholder={t`{{fetchStep.mostRecentPost.socialId}}`}
          readonly={actionOptions.readonly}
          defaultValue={formData.postId}
          onChange={(value) => handleFieldChange('postId', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Comment text`}
          placeholder={t`Write the LinkedIn comment…`}
          multiline
          readonly={actionOptions.readonly}
          defaultValue={formData.text}
          onChange={(value) => handleFieldChange('text', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Reply to comment ID`}
          placeholder={t`Optional. Reply to an existing comment instead of the post`}
          readonly={actionOptions.readonly}
          defaultValue={formData.commentId}
          onChange={(value) => handleFieldChange('commentId', value)}
          VariablePicker={WorkflowVariablePicker}
        />
      </WorkflowStepBody>
      {!actionOptions.readonly && <WorkflowStepFooter stepId={action.id} />}
    </>
  );
};
