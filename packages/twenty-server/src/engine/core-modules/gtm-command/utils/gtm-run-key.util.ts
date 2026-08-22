import { isNonEmptyString } from '@sniptt/guards';

export const parseGtmRunKeys = (value: unknown): string[] => {
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
        return parseGtmRunKeys(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return parseGtmRunKeys(
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

export const gtmRunKeyHasProject = (
  value: unknown,
  projectId: string,
): boolean => parseGtmRunKeys(value).includes(projectId);

export const appendGtmRunKey = (
  value: unknown,
  projectId: string,
): string[] => {
  const keys = parseGtmRunKeys(value);

  if (!isNonEmptyString(projectId) || keys.includes(projectId)) {
    return keys;
  }

  return [...keys, projectId];
};
