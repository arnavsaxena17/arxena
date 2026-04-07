/** Mirrors server `getSubdomainFromEmail` first-label behavior for suggested workspace display name. */
export const getSuggestedWorkspaceDisplayNameFromEmail = (
  email: string,
): string => {
  const at = email.indexOf('@');
  if (at === -1) {
    return email.trim() || 'Workspace';
  }
  const domain = email.slice(at + 1);
  const firstLabel = domain.split('.')[0];

  return firstLabel?.trim() || 'Workspace';
};
