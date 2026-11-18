import { isNonEmptyString } from '@sniptt/guards';

export type OutreachSenderProfileDraft = {
  targetTitles: string[];
  locations: string[];
  brief: string;
};

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const EMPTY_SENDER_PROFILE_DRAFT: OutreachSenderProfileDraft = {
  targetTitles: [],
  locations: [],
  brief: '',
};

export const parseSenderProfileDraft = (
  draftJson: string,
): OutreachSenderProfileDraft | null => {
  try {
    const parsed: unknown = JSON.parse(draftJson);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return normalizeSenderProfileDraft(parsed);
  } catch {
    return null;
  }
};

export const normalizeSenderProfileDraft = (
  value: unknown,
): OutreachSenderProfileDraft => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_SENDER_PROFILE_DRAFT };
  }

  const record = value as Record<string, unknown>;

  // Fat legacy → keep titles/locations if present under icp; brief empty for UI
  // (server migration folds fat → brief; UI only edits slim).
  if ('identity' in record || 'icp' in record) {
    const icp =
      record.icp !== null &&
      typeof record.icp === 'object' &&
      !Array.isArray(record.icp)
        ? (record.icp as Record<string, unknown>)
        : {};

    return {
      targetTitles: toStringList(icp.target_roles ?? record.targetTitles),
      locations: toStringList(icp.geography ?? record.locations),
      brief: typeof record.brief === 'string' ? record.brief : '',
    };
  }

  return {
    targetTitles: toStringList(record.targetTitles),
    locations: toStringList(record.locations),
    brief: typeof record.brief === 'string' ? record.brief : '',
  };
};

export const stringifySenderProfileDraft = (
  draft: OutreachSenderProfileDraft,
): string => JSON.stringify(draft);

export const readSenderDraftBrief = (draftJson: string): string =>
  parseSenderProfileDraft(draftJson)?.brief ?? '';

export const writeSenderDraftBrief = (
  draftJson: string,
  brief: string,
): string => {
  const current =
    parseSenderProfileDraft(draftJson) ?? EMPTY_SENDER_PROFILE_DRAFT;

  return stringifySenderProfileDraft({ ...current, brief });
};

export const readSenderDraftChipList = (
  draftJson: string,
  key: 'targetTitles' | 'locations',
): string[] => parseSenderProfileDraft(draftJson)?.[key] ?? [];

export const writeSenderDraftChipList = (
  draftJson: string,
  key: 'targetTitles' | 'locations',
  values: string[],
): string => {
  const current =
    parseSenderProfileDraft(draftJson) ?? EMPTY_SENDER_PROFILE_DRAFT;

  return stringifySenderProfileDraft({
    ...current,
    [key]: values
      .map((value) => value.trim())
      .filter((value) => isNonEmptyString(value)),
  });
};

export const summarizeSenderProfileDraft = (
  profile: Record<string, unknown> | null | undefined,
): string | null => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const normalized = normalizeSenderProfileDraft(profile);
  const titles =
    normalized.targetTitles.length > 0
      ? normalized.targetTitles.slice(0, 3).join(', ')
      : '';
  const briefPreview = normalized.brief.trim().slice(0, 80);

  if (titles && briefPreview) {
    return `${titles} · ${briefPreview}${normalized.brief.length > 80 ? '…' : ''}`;
  }

  return titles || briefPreview || null;
};
