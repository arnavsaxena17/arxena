import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';
import { flattenFatOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/flatten-fat-outreach-sender-profile.util';

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(isNonEmptyString),
    ),
  ];
};

export const EMPTY_OUTREACH_SENDER_PROFILE: OutreachSenderProfile = {
  targetTitles: [],
  locations: [],
  brief: '',
  collateralFiles: [],
};

export const normalizeOutreachSenderProfile = (
  value: unknown,
): OutreachSenderProfile => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_OUTREACH_SENDER_PROFILE };
  }

  const record = value as Record<string, unknown>;

  if ('identity' in record || 'offer' in record || 'icp' in record) {
    return flattenFatOutreachSenderProfile(record);
  }

  const collateralFiles = Array.isArray(record.collateralFiles)
    ? record.collateralFiles
        .map((item) => {
          if (
            item === null ||
            typeof item !== 'object' ||
            Array.isArray(item)
          ) {
            return null;
          }

          const file = item as Record<string, unknown>;
          const fileId =
            typeof file.fileId === 'string' ? file.fileId.trim() : '';
          const fileName =
            typeof file.fileName === 'string' ? file.fileName.trim() : '';

          if (!isNonEmptyString(fileId) || !isNonEmptyString(fileName)) {
            return null;
          }

          return {
            fileId,
            fileName,
            mimeType:
              typeof file.mimeType === 'string' ? file.mimeType : undefined,
          };
        })
        .filter(isDefined)
    : [];

  return {
    targetTitles: toStringList(record.targetTitles),
    locations: toStringList(record.locations),
    brief: typeof record.brief === 'string' ? record.brief.trim() : '',
    collateralFiles,
  };
};

export const buildSenderProfileSeed = (input: {
  targetTitles?: string[];
  locations?: string[];
  brief?: string | null;
  companyName?: string | null;
  industry?: string | null;
  summary?: string | null;
  fullName?: string | null;
  title?: string | null;
}): OutreachSenderProfile => {
  const briefParts = [
    isNonEmptyString(input.fullName?.trim())
      ? `Sender: ${input.fullName.trim()}${
          isNonEmptyString(input.title?.trim())
            ? ` · ${input.title.trim()}`
            : ''
        }${
          isNonEmptyString(input.companyName?.trim())
            ? ` · ${input.companyName.trim()}`
            : ''
        }`
      : '',
    isNonEmptyString(input.summary?.trim())
      ? `Offer: ${input.summary.trim()}`
      : '',
    isNonEmptyString(input.industry?.trim())
      ? `Industry: ${input.industry.trim()}`
      : '',
  ].filter(isNonEmptyString);

  return {
    targetTitles: toStringList(input.targetTitles),
    locations: toStringList(input.locations),
    brief: isNonEmptyString(input.brief?.trim())
      ? input.brief.trim()
      : briefParts.join('\n'),
    collateralFiles: [],
  };
};
