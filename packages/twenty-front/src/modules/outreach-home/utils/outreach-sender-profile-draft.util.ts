import { isNonEmptyString } from '@sniptt/guards';

import { toStringList } from '@/outreach-home/utils/outreach-icp-chip-fields.util';

export type OutreachSenderProfileDraft = {
  targetTitles: string[];
  locations: string[];
  brief: string;
};

export const EMPTY_SENDER_PROFILE_DRAFT: OutreachSenderProfileDraft = {
  targetTitles: [],
  locations: [],
  brief: '',
};

const readDraftBrief = (record: Record<string, unknown>): string => {
  if (typeof record.brief === 'string') {
    return record.brief;
  }

  // Legacy slim key until stored drafts are rewritten.
  if (typeof record.prose === 'string') {
    return record.prose;
  }

  return '';
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
      brief: readDraftBrief(record),
    };
  }

  return {
    targetTitles: toStringList(record.targetTitles),
    locations: toStringList(record.locations),
    brief: readDraftBrief(record),
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
