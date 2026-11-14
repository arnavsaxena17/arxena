import { isNonEmptyString } from '@sniptt/guards';

export const parseProjectIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => isNonEmptyString(item)),
      ),
    ];
  }

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();

    if (trimmed.startsWith('[')) {
      try {
        return parseProjectIds(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return parseProjectIds(
        trimmed
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim().replace(/^"|"$/g, ''))
          .filter((item) => isNonEmptyString(item)),
      );
    }

    return [trimmed];
  }

  return [];
};

export const projectIdsHasProject = (
  value: unknown,
  projectId: string,
): boolean => parseProjectIds(value).includes(projectId);

export const appendProjectId = (
  value: unknown,
  projectId: string,
): string[] => {
  const keys = parseProjectIds(value);

  if (!isNonEmptyString(projectId) || keys.includes(projectId)) {
    return keys;
  }

  return [...keys, projectId];
};
