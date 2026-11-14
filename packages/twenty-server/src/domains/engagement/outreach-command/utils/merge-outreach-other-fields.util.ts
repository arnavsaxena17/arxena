// Merge row otherFields on re-attach: add and update source keys, never drop
// keys already on the row. Values written by an AI column stay put — a fresh
// search must not overwrite an answered storeCount / authenticity cell.
export const mergeOutreachOtherFields = (
  previous?: Record<string, unknown>,
  incoming?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const previousFields = previous ?? {};
  const incomingFields = incoming ?? {};
  const previousAiColumns =
    typeof previousFields.aiColumns === 'object' &&
    previousFields.aiColumns !== null &&
    !Array.isArray(previousFields.aiColumns)
      ? (previousFields.aiColumns as Record<string, unknown>)
      : {};
  const protectedAnswerKeys = new Set(Object.keys(previousAiColumns));
  const merged: Record<string, unknown> = { ...previousFields };

  for (const [key, value] of Object.entries(incomingFields)) {
    if (key === 'aiColumns') {
      continue;
    }

    if (protectedAnswerKeys.has(key)) {
      continue;
    }

    merged[key] = value;
  }

  const incomingAiColumns =
    typeof incomingFields.aiColumns === 'object' &&
    incomingFields.aiColumns !== null &&
    !Array.isArray(incomingFields.aiColumns)
      ? (incomingFields.aiColumns as Record<string, unknown>)
      : {};

  if (
    Object.keys(previousAiColumns).length > 0 ||
    Object.keys(incomingAiColumns).length > 0
  ) {
    merged.aiColumns = { ...previousAiColumns, ...incomingAiColumns };
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};
