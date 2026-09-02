/** Default warm-paths gate for front bundles and server API. */
export const isWarmPathsEnabledEnv = false;

export const resolveIsWarmPathsEnabledFromWorkspace = (
  workspaceValue: string | null | undefined,
): boolean => {
  if (workspaceValue == null || String(workspaceValue).trim() === '') {
    return isWarmPathsEnabledEnv;
  }

  return String(workspaceValue).trim() === 'true';
};
