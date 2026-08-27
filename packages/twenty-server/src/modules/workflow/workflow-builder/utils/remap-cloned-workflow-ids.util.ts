const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const remapClonedWorkflowIds = <T>(
  value: T,
  oldToNewIdMap: Map<string, string>,
): T => {
  if (oldToNewIdMap.size === 0) {
    return value;
  }

  const serialized = JSON.stringify(value);
  const pattern = new RegExp(
    [...oldToNewIdMap.keys()].map(escapeRegExp).join('|'),
    'g',
  );

  return JSON.parse(
    serialized.replace(pattern, (oldId) => oldToNewIdMap.get(oldId) ?? oldId),
  ) as T;
};
