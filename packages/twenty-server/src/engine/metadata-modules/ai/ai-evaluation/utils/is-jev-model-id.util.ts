import { JEV_MODEL_ALIASES } from 'src/engine/metadata-modules/ai/ai-evaluation/constants/jev.const';

export const isJevModelId = (modelId: string | null | undefined): boolean => {
  if (!modelId) {
    return false;
  }

  const normalizedModelId = modelId.trim().toLowerCase();

  return JEV_MODEL_ALIASES.some(
    (alias) =>
      normalizedModelId === alias.toLowerCase() ||
      normalizedModelId.endsWith(`/${alias.toLowerCase()}`),
  );
};
