import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import { FormTextFieldInput } from '@/object-record/record-field/ui/form-types/components/FormTextFieldInput';
import { type WorkflowLikeLinkedinPostAction } from '@/workflow/types/Workflow';
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
  reactionType: string;
  commentId: string;
};

type WorkflowEditActionLikeLinkedinPostProps = {
  action: WorkflowLikeLinkedinPostAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowLikeLinkedinPostAction) => void;
      };
};

export const WorkflowEditActionLikeLinkedinPost = ({
  action,
  actionOptions,
}: WorkflowEditActionLikeLinkedinPostProps) => {
  const { formData, handleFieldChange, saveAction } = useUnipileMessagingForm({
    initialFormData: {
      workspaceMemberId: action.settings.input.workspaceMemberId,
      postId: action.settings.input.postId,
      reactionType: action.settings.input.reactionType ?? 'like',
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
            reactionType: nextFormData.reactionType as
              | 'like'
              | 'celebrate'
              | 'support'
              | 'love'
              | 'insightful'
              | 'funny',
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
          label={t`React as`}
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
          placeholder="{{fetchStep.mostRecentPost.socialId}}"
          readonly={actionOptions.readonly}
          defaultValue={formData.postId}
          onChange={(value) => handleFieldChange('postId', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Reaction type`}
          placeholder={t`like, celebrate, support, love, insightful, funny`}
          readonly={actionOptions.readonly}
          defaultValue={formData.reactionType}
          onChange={(value) => handleFieldChange('reactionType', value)}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label={t`Comment ID`}
          placeholder={t`Optional. React to a comment instead of the post`}
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
