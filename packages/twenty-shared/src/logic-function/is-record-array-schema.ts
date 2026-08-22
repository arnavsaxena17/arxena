import { isNonEmptyString } from '@sniptt/guards';

import { isRecordObjectSchema } from '@/logic-function/is-record-object-schema';

type RecordArraySchema = {
  type?: string;
  objectUniversalIdentifier?: string;
  objectNameSingular?: string;
  items?: {
    type?: string;
    objectUniversalIdentifier?: string;
    objectNameSingular?: string;
  } | null;
};

export const isRecordArraySchema = (
  schema: RecordArraySchema | null | undefined,
): boolean =>
  (schema?.type === 'records' &&
    (isNonEmptyString(schema.objectUniversalIdentifier) ||
      isNonEmptyString(schema.objectNameSingular))) ||
  (schema?.type === 'array' && isRecordObjectSchema(schema?.items));
