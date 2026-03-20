export const buildIterativeRequirement = (
  baseRequirement: string,
  steeringHistory: Array<Record<string, unknown>>,
): string => {
  return [
    `Base requirement: ${baseRequirement}`,
    steeringHistory.length > 0
      ? `User steering updates:\n${steeringHistory
          .map((entry, index) => `${index + 1}. ${String(entry.message ?? '')}`)
          .join('\n')}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');
};
