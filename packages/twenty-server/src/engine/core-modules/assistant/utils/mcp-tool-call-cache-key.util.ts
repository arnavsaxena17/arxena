export const getToolCallCacheKey = (
  name: string,
  args: Record<string, unknown>,
): string => {
  const normalized = JSON.stringify(
    Object.keys(args)
      .sort()
      .reduce(
        (acc, key) => {
          const value = args[key];
          if (typeof value === 'string') {
            acc[key] = value.trim().toLowerCase();
          } else {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, unknown>,
      ),
  );
  return `${name}:${normalized}`;
};
