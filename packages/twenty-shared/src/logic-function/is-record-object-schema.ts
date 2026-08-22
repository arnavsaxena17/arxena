import { isNonEmptyString } from '@sniptt/guards';

type RecordObjectSchema = {
  type?: string;
  objectUniversalIdentifier?: string;
  objectNameSingular?: string;
};

export const isRecordObjectSchema = <TSchema extends RecordObjectSchema>(
  schema: TSchema | null | undefined,
): schema is TSchema & { type: 'record' | 'object' } =>
  (schema?.type === 'record' || schema?.type === 'object') &&
  (isNonEmptyString(schema.objectUniversalIdentifier) ||
    isNonEmptyString(schema.objectNameSingular));
