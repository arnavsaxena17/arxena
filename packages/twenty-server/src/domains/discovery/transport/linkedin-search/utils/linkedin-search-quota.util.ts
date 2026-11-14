export type LinkedInSearchQuotaInput = {
  cursor?: string | null;
  start?: number;
  offset?: number;
  countSearchQuota?: boolean;
};

const hasContinuationCursor = (cursor?: string | null): boolean =>
  typeof cursor === 'string' && cursor.trim().length > 0;

const isPositiveOffset = (value?: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const isLinkedInSearchCursorRequest = (
  searchRequest: unknown,
): searchRequest is { cursor: string } => {
  if (searchRequest == null || typeof searchRequest !== 'object') {
    return false;
  }

  const request = searchRequest as Record<string, unknown>;

  return (
    typeof request.cursor === 'string' &&
    request.cursor.trim().length > 0 &&
    !('api' in request) &&
    !('url' in request) &&
    !('category' in request)
  );
};

/**
 * LinkedIn searchPerMinute / searchPerDay apply to a logical search
 * (org chart or people search), not to each Unipile page and not to
 * location / company / industry parameter lookups.
 */
export const shouldCountLinkedInSearchQuota = (
  input: LinkedInSearchQuotaInput,
): boolean => {
  if (input.countSearchQuota === false) {
    return false;
  }

  if (hasContinuationCursor(input.cursor)) {
    return false;
  }

  if (isPositiveOffset(input.start) || isPositiveOffset(input.offset)) {
    return false;
  }

  return true;
};
