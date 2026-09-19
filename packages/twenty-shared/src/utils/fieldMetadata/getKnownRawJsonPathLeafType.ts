import { FieldMetadataType } from '@/types';

import { CANDIDATE_BOOLEAN_FLAG_KEYS } from '../../arx/candidateFlags';
import { getKnownRawJsonPathKeysForField } from './getKnownRawJsonPathKeysForField';
import { isRawJsonNumericPathKey } from './isRawJsonNumericPathKey';

const CANDIDATE_BOOLEAN_FLAG_KEY_SET = new Set<string>(
  CANDIDATE_BOOLEAN_FLAG_KEYS,
);

// Leaf type published in workflow output schemas for known RAW_JSON paths.
// CRM record filters still treat the parent as RAW_JSON + path; workflows need
// BOOLEAN so gate filters get True/False operands instead of Contains.
export const getKnownRawJsonPathLeafType = ({
  fieldName,
  pathKey,
}: {
  fieldName: string;
  pathKey: string;
}): FieldMetadataType | undefined => {
  const knownPaths = getKnownRawJsonPathKeysForField(fieldName);

  if (!knownPaths?.includes(pathKey)) {
    return undefined;
  }

  if (fieldName === 'candidateFlags') {
    if (CANDIDATE_BOOLEAN_FLAG_KEY_SET.has(pathKey)) {
      return FieldMetadataType.BOOLEAN;
    }

    return FieldMetadataType.TEXT;
  }

  if (isRawJsonNumericPathKey(pathKey)) {
    return FieldMetadataType.NUMBER;
  }

  return FieldMetadataType.TEXT;
};
