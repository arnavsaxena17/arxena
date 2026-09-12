import { toStringList } from '@/outreach-home/utils/outreach-icp-chip-fields.util';

export type OutreachSenderFaqDraftItem = {
  q: string;
  a: string;
};

export type OutreachSenderObjectionDraftItem = {
  objection: string;
  response: string;
};

export const parseSenderProfileDraft = (
  draftJson: string,
): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(draftJson);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getNestedRecord = (
  root: Record<string, unknown>,
  section: string,
): Record<string, unknown> => {
  const value = root[section];

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

export const readSenderDraftString = (
  draftJson: string,
  section: string,
  key: string,
): string => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return '';
  }

  const value = getNestedRecord(parsed, section)[key];

  return typeof value === 'string' ? value : '';
};

export const readSenderDraftStringList = (
  draftJson: string,
  section: string,
  key: string,
): string[] => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return [];
  }

  return toStringList(getNestedRecord(parsed, section)[key]);
};

export const readSenderDraftBoolean = (
  draftJson: string,
  section: string,
  key: string,
): boolean => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return false;
  }

  return getNestedRecord(parsed, section)[key] === true;
};

export const readSenderDraftNumber = (
  draftJson: string,
  section: string,
  key: string,
): number | null => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return null;
  }

  const value = getNestedRecord(parsed, section)[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const readSenderDraftReviewFlags = (draftJson: string): string[] => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return [];
  }

  return toStringList(parsed.review_flags);
};

export const readSenderDraftFaq = (
  draftJson: string,
): OutreachSenderFaqDraftItem[] => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return [];
  }

  const faq = getNestedRecord(parsed, 'offer').faq;

  if (!Array.isArray(faq)) {
    return [];
  }

  return faq.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;

    return [
      {
        q: typeof record.q === 'string' ? record.q : '',
        a: typeof record.a === 'string' ? record.a : '',
      },
    ];
  });
};

export const readSenderDraftObjections = (
  draftJson: string,
): OutreachSenderObjectionDraftItem[] => {
  const parsed = parseSenderProfileDraft(draftJson);

  if (parsed === null) {
    return [];
  }

  const objections = getNestedRecord(parsed, 'icp').known_objections;

  if (!Array.isArray(objections)) {
    return [];
  }

  return objections.flatMap((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;

    return [
      {
        objection: typeof record.objection === 'string' ? record.objection : '',
        response: typeof record.response === 'string' ? record.response : '',
      },
    ];
  });
};

const writeNestedField = (
  draftJson: string,
  section: string,
  key: string,
  value: unknown,
): string => {
  const parsed = parseSenderProfileDraft(draftJson) ?? {};
  const nested = { ...getNestedRecord(parsed, section), [key]: value };

  return JSON.stringify({ ...parsed, [section]: nested }, null, 2);
};

export const writeSenderDraftString = (
  draftJson: string,
  section: string,
  key: string,
  value: string,
): string => writeNestedField(draftJson, section, key, value || null);

export const writeSenderDraftStringList = (
  draftJson: string,
  section: string,
  key: string,
  values: string[],
): string => writeNestedField(draftJson, section, key, values);

export const writeSenderDraftBoolean = (
  draftJson: string,
  section: string,
  key: string,
  value: boolean,
): string => writeNestedField(draftJson, section, key, value);

export const writeSenderDraftNumber = (
  draftJson: string,
  section: string,
  key: string,
  value: number | null,
): string => writeNestedField(draftJson, section, key, value);

export const writeSenderDraftFaq = (
  draftJson: string,
  faq: OutreachSenderFaqDraftItem[],
): string => writeNestedField(draftJson, 'offer', 'faq', faq);

export const writeSenderDraftObjections = (
  draftJson: string,
  objections: OutreachSenderObjectionDraftItem[],
): string => writeNestedField(draftJson, 'icp', 'known_objections', objections);
