const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try {
      return toRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

// Returns null when nothing would change (so callers can skip the write).
export const stripAiColumnKeys = (
  existing: unknown,
  columnKeys: string[],
): Record<string, unknown> | null => {
  const current = toRecord(existing);
  const aiColumns = toRecord(current.aiColumns);
  let changed = false;
  const next: Record<string, unknown> = { ...current };
  const nextAiColumns = { ...aiColumns };

  for (const key of columnKeys) {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      delete next[key];
      changed = true;
    }

    if (Object.prototype.hasOwnProperty.call(nextAiColumns, key)) {
      delete nextAiColumns[key];
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  if (Object.keys(nextAiColumns).length === 0) {
    delete next.aiColumns;
  } else {
    next.aiColumns = nextAiColumns;
  }

  return next;
};
