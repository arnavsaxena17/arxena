export const mergeExtraEnabledAiModels = <T extends { modelId: string }>(
  enabledModels: T[],
  catalogModels: T[],
  extraModelIds: readonly string[],
): T[] => {
  if (extraModelIds.length === 0) {
    return enabledModels;
  }

  const extraIdSet = new Set(extraModelIds);
  const seen = new Set(enabledModels.map((model) => model.modelId));
  const extras = catalogModels.filter(
    (model) => extraIdSet.has(model.modelId) && !seen.has(model.modelId),
  );

  return extras.length === 0 ? enabledModels : [...enabledModels, ...extras];
};
