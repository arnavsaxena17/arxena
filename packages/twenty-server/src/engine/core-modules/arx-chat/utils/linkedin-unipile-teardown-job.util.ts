export const LINKEDIN_UNIPILE_TEARDOWN_PROCESSOR_NAME =
  'LinkedinUnipileTeardownProcessor';

export const getLinkedinUnipileTeardownJobId = (
  workspaceMemberId: string,
): string => `linkedin-unipile-teardown-${workspaceMemberId.trim()}`;
