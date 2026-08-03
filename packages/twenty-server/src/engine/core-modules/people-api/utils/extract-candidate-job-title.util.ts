const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const extractCandidateJobTitle = (
  candidate: Record<string, unknown>,
): string | null => {
  const direct =
    asNonEmptyString(candidate.jobTitle) ??
    asNonEmptyString(candidate.job_title) ??
    asNonEmptyString(candidate.title) ??
    asNonEmptyString(candidate.headline);
  if (direct) {
    return direct;
  }

  const currentPositions = candidate.currentPositions;
  if (Array.isArray(currentPositions) && currentPositions.length > 0) {
    const firstPosition = currentPositions[0];
    if (firstPosition && typeof firstPosition === 'object') {
      const title = asNonEmptyString(
        (firstPosition as { title?: unknown }).title,
      );
      if (title) {
        return title;
      }
    }
  }

  const currentPositionsSnake = candidate.current_positions;
  if (
    Array.isArray(currentPositionsSnake) &&
    currentPositionsSnake.length > 0
  ) {
    const firstPosition = currentPositionsSnake[0];
    if (firstPosition && typeof firstPosition === 'object') {
      return asNonEmptyString((firstPosition as { title?: unknown }).title);
    }
  }

  return null;
};
