import { t } from '@lingui/core/macro';
import { AUTO_SELECT_SMART_MODEL_ID } from 'twenty-shared/constants';
import { isAutoSelectModelId } from 'twenty-shared/utils';
import { type SelectOption } from 'twenty-ui/input';

import { useWorkspaceAiModelAvailability } from '@/ai/hooks/useWorkspaceAiModelAvailability';
import { mergeExtraEnabledAiModels } from '@/ai/utils/mergeExtraEnabledAiModels';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { aiModelsState } from '@/client-config/states/aiModelsState';
import { getModelIcon } from '@/settings/ai/utils/getModelIcon';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

type UseAiModelOptionsVariant = 'all' | 'pinned-default';

type UseAiModelOptionsOptions = {
  variant?: UseAiModelOptionsVariant;
  extraModelIds?: readonly string[];
};

export const useAiModelOptions = ({
  variant = 'all',
  extraModelIds = [],
}: UseAiModelOptionsOptions = {}): {
  options: SelectOption<string>[];
  pinnedOption?: SelectOption<string>;
} => {
  const aiModels = useAtomStateValue(aiModelsState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const { enabledModels, realModels } = useWorkspaceAiModelAvailability();
  const selectableModels = mergeExtraEnabledAiModels(
    enabledModels,
    realModels,
    extraModelIds,
  );

  // Label from workspace.smartModel (concrete or auto-select entry); pin value
  // is always AUTO_SELECT_SMART_MODEL_ID so seeded agents match the Select.
  const workspaceSmartModel =
    aiModels.find((model) => model.modelId === currentWorkspace?.smartModel) ??
    aiModels.find((model) => model.modelId === AUTO_SELECT_SMART_MODEL_ID);

  // Keep concrete models in `options` even when they match the pin label.
  // Agents like extract-signals store a concrete DeepSeek id; filtering it out
  // made Select fall back to options[0] (e.g. Claude Opus) and lie in the UI.
  const options = selectableModels
    .filter((model) => !isAutoSelectModelId(model.modelId))
    .map((model) => ({
      value: model.modelId,
      label: model.label,
      Icon: getModelIcon(model.modelFamily, model.providerName),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const pinnedOption = workspaceSmartModel
    ? {
        value: AUTO_SELECT_SMART_MODEL_ID,
        label: workspaceSmartModel.label,
        Icon: getModelIcon(
          workspaceSmartModel.modelFamily,
          workspaceSmartModel.providerName,
        ),
        contextualText: t`default`,
      }
    : undefined;

  return {
    options,
    pinnedOption: variant === 'pinned-default' ? pinnedOption : undefined,
  };
};

export const useAiModelLabel = (
  modelId: string | undefined,
  includeProvider = true,
): string => {
  const aiModels = useAtomStateValue(aiModelsState);

  if (!modelId) {
    return '';
  }

  const model = aiModels.find((m) => m.modelId === modelId);

  if (!model) {
    return modelId;
  }

  if (isAutoSelectModelId(model.modelId) || !includeProvider) {
    return model.label;
  }

  return model.modelFamilyLabel
    ? `${model.label} (${model.modelFamilyLabel})`
    : model.label;
};
