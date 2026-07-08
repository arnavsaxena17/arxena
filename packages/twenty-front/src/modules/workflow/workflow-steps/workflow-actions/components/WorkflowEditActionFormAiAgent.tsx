import { FormTextFieldInput } from '@/object-record/record-field/form-types/components/FormTextFieldInput';
import { WorkflowAiAgentAction } from '@/workflow/types/Workflow';
import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';
import { WorkflowStepHeader } from '@/workflow/workflow-steps/components/WorkflowStepHeader';
import { getActionIcon } from '@/workflow/workflow-steps/workflow-actions/utils/getActionIcon';
import { WorkflowVariablePicker } from '@/workflow/workflow-variables/components/WorkflowVariablePicker';
import { useTheme } from '@emotion/react';
import { useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared';
import { useIcons } from 'twenty-ui';
import { useDebouncedCallback } from 'use-debounce';

type WorkflowEditActionFormAiAgentProps = {
  action: WorkflowAiAgentAction;
  actionOptions:
    | {
        readonly: true;
      }
    | {
        readonly?: false;
        onActionUpdate: (action: WorkflowAiAgentAction) => void;
      };
};

type AiAgentFormData = {
  agentId: string;
  prompt: string;
  systemPrompt: string;
};

export const WorkflowEditActionFormAiAgent = ({
  action,
  actionOptions,
}: WorkflowEditActionFormAiAgentProps) => {
  const theme = useTheme();
  const { getIcon } = useIcons();

  const [formData, setFormData] = useState<AiAgentFormData>({
    agentId: action.settings.input.agentId ?? '',
    prompt: action.settings.input.prompt ?? '',
    systemPrompt: action.settings.input.systemPrompt ?? '',
  });

  const saveAction = useDebouncedCallback(async (nextFormData: AiAgentFormData) => {
    if (actionOptions.readonly === true) {
      return;
    }

    actionOptions.onActionUpdate({
      ...action,
      settings: {
        ...action.settings,
        input: {
          agentId: nextFormData.agentId,
          prompt: nextFormData.prompt,
          systemPrompt: nextFormData.systemPrompt,
        },
      },
    });
  }, 1_000);

  useEffect(() => {
    return () => {
      saveAction.flush();
    };
  }, [saveAction]);

  const handleFieldChange = (
    fieldName: keyof AiAgentFormData,
    updatedValue: string,
  ) => {
    const newFormData: AiAgentFormData = {
      ...formData,
      [fieldName]: updatedValue,
    };

    setFormData(newFormData);
    saveAction(newFormData);
  };

  const headerTitle = isDefined(action.name) ? action.name : 'AI Agent';
  const headerIcon = getActionIcon(action.type);

  return (
    <>
      <WorkflowStepHeader
        onTitleChange={(newName: string) => {
          if (actionOptions.readonly === true) {
            return;
          }

          actionOptions.onActionUpdate({
            ...action,
            name: newName,
          });
        }}
        Icon={getIcon(headerIcon)}
        iconColor={theme.color.pink}
        initialTitle={headerTitle}
        headerType="AI Agent"
        disabled={actionOptions.readonly}
      />
      <WorkflowStepBody>
        <FormTextFieldInput
          label="Agent"
          placeholder="Agent id (optional)"
          readonly={actionOptions.readonly}
          defaultValue={formData.agentId}
          onPersist={(agentId) => {
            handleFieldChange('agentId', agentId);
          }}
          VariablePicker={WorkflowVariablePicker}
        />
        <FormTextFieldInput
          label="System prompt"
          placeholder="Describe how the agent should behave"
          readonly={actionOptions.readonly}
          defaultValue={formData.systemPrompt}
          onPersist={(systemPrompt) => {
            handleFieldChange('systemPrompt', systemPrompt);
          }}
          VariablePicker={WorkflowVariablePicker}
          multiline
        />
        <FormTextFieldInput
          label="Prompt"
          placeholder="What should the agent do?"
          readonly={actionOptions.readonly}
          defaultValue={formData.prompt}
          onPersist={(prompt) => {
            handleFieldChange('prompt', prompt);
          }}
          VariablePicker={WorkflowVariablePicker}
          multiline
        />
      </WorkflowStepBody>
    </>
  );
};
