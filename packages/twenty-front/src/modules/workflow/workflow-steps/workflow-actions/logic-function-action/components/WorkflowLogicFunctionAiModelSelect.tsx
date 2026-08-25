import { useAiModelOptions } from '@/ai/hooks/useAiModelOptions';
import { Select } from '@/ui/input/components/Select';
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
