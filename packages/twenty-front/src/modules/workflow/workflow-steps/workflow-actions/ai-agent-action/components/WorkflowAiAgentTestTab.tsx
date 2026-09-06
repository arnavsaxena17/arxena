import { FormSingleRecordPicker } from '@/object-record/record-field/ui/form-types/components/FormSingleRecordPicker';
import {
  type RecordId,
  type Variable,
} from '@/object-record/record-field/ui/form-types/types/RecordPickerValue';
import { type WorkflowAiAgentAction } from '@/workflow/types/Workflow';
import { AiAgentExecutionResult } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/components/AiAgentExecutionResult';
import { WorkflowAiAgentPromptTab } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/components/WorkflowAiAgentPromptTab';
import { type AiAgentTestData } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/types/AiAgentTestData';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { isValidUuid } from 'twenty-shared/utils';
import { Callout } from 'twenty-ui/feedback';
import { IconAlertTriangle } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type WorkflowAiAgentTestTabProps = {
  action: WorkflowAiAgentAction;
  prompt: string;
  candidateId: string | undefined;
  readonly: boolean;
  isTesting: boolean;
  aiAgentTestData: AiAgentTestData;
  onCandidateChange: (candidateId: string | undefined) => void;
  onPromptChange: (value: string) => void;
  onActionUpdate?: (action: WorkflowAiAgentAction) => void;
};

const StyledTestTabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  height: 100%;
  min-height: 400px;
`;

export const WorkflowAiAgentTestTab = ({
  action,
  prompt,
  candidateId,
  readonly,
  isTesting,
  aiAgentTestData,
  onCandidateChange,
  onPromptChange,
  onActionUpdate,
}: WorkflowAiAgentTestTabProps) => {
  const { t } = useLingui();

  const handleCandidateChange = (value: RecordId | Variable | null) => {
    if (isNonEmptyString(value) && isValidUuid(value)) {
      onCandidateChange(value);

      return;
    }

    onCandidateChange(undefined);
  };

  return (
    <StyledTestTabContent>
      <Callout
        variant={'warning'}
        Icon={IconAlertTriangle}
        title={t`Runs the agent with its tools`}
        description={t`Pick a candidate to load previous nodes (profile, messages, candidate fields) into this prompt. Open a different AI node to test that message type. Record changes and credit usage are real.`}
      />
      <FormSingleRecordPicker
        label={t`Candidate`}
        defaultValue={candidateId}
        onChange={handleCandidateChange}
        objectNameSingulars={['candidate']}
        disabled={readonly}
      />
      <WorkflowAiAgentPromptTab
        action={action}
        prompt={prompt}
        readonly={readonly}
        modelSelectDropdownId={`select-agent-model-test-${action.id}`}
        onPromptChange={onPromptChange}
        onActionUpdate={onActionUpdate}
      />
      <AiAgentExecutionResult
        aiAgentTestData={aiAgentTestData}
        isTesting={isTesting}
      />
    </StyledTestTabContent>
  );
};
