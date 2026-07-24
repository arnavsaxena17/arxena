export type SuperImposeAppendEligibilityInput = {
  isBlankTemplate: boolean;
  firstSourceUsed?: string | null;
  latestOrgChart?: Record<string, unknown> | null;
  itemCount?: number | null;
  isDifferentTargetCompany?: boolean;
};

export const canAppendToExistingSuperImposeChart = (
  input: SuperImposeAppendEligibilityInput,
): { eligible: boolean; reason?: string } => {
  if (input.isDifferentTargetCompany) {
    return {
      eligible: false,
      reason: 'Append is only available for the current chart company.',
    };
  }

  if (input.isBlankTemplate) {
    return {
      eligible: false,
      reason: 'Cannot append to a preview template chart.',
    };
  }

  const candidateSource =
    typeof input.latestOrgChart?.candidateSource === 'string'
      ? input.latestOrgChart.candidateSource.trim()
      : '';
  const hasSavedChart =
    candidateSource.length > 0 || (input.itemCount ?? 0) > 0;

  if (input.firstSourceUsed === 'elasticsearch' && !hasSavedChart) {
    return {
      eligible: false,
      reason: 'Generate a full org chart before appending.',
    };
  }

  if (!hasSavedChart) {
    return {
      eligible: false,
      reason: 'No saved org chart to append to.',
    };
  }

  return { eligible: true };
};

export const parseMultilineUrlInput = (raw: string): string[] =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
