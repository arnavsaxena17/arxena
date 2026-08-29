import { useAiModelOptions } from '@/ai/hooks/useAiModelOptions';
import { Select } from '@/ui/input/components/Select';
import { OUTREACH_LOGIC_FUNCTION_EXTRA_AI_MODEL_IDS } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/constants/outreachLogicFunctionExtraAiModelIds';
import { t } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';

type WorkflowLogicFunctionAiModelSelectProps = {
  value: unknown;
  readonly?: boolean;
  dropdownId: string;
  onChange: (modelId: string) => void;
};

export const WorkflowLogicFunctionAiModelSelect = ({
  value,
  readonly,
  dropdownId,
  onChange,
}: WorkflowLogicFunctionAiModelSelectProps) => {
  const { options: aiModelOptions, pinnedOption } = useAiModelOptions({
    variant: 'pinned-default',
    extraModelIds: OUTREACH_LOGIC_FUNCTION_EXTRA_AI_MODEL_IDS,
  });

  const selectedValue = isNonEmptyString(value)
    ? value
    : (pinnedOption?.value ?? '');

  return (
    <Select
      label={t`Model`}
      dropdownId={dropdownId}
      options={aiModelOptions}
      pinnedOption={pinnedOption}
      value={selectedValue}
      onChange={onChange}
      showContextualTextInControl={false}
      disabled={readonly}
      fullWidth
      withSearchInput
    />
  );
};
