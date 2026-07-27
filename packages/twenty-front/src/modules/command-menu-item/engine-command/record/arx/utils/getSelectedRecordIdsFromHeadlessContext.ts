import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { isDefined } from 'twenty-shared/utils';

type RecordWithOptionalTempId = ObjectRecord & {
  tempId?: string;
};

export const getRecordIdOrTempId = (
  record: RecordWithOptionalTempId,
): string | null => {
  const recordId = record.tempId ?? record.id;

  if (!isDefined(recordId)) {
    return null;
  }

  return recordId;
};

export const getSelectedRecordIdsFromHeadlessContext = (
  selectedRecords: ObjectRecord[],
): string[] => {
  return selectedRecords
    .map((record) => getRecordIdOrTempId(record))
    .filter((recordId): recordId is string => isDefined(recordId));
};

export const getUniqueRecordIdsFromRecords = (
  records: ObjectRecord[],
): string[] => {
  return [...new Set(getSelectedRecordIdsFromHeadlessContext(records))];
};
