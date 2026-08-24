import { defineField, FieldType } from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'shortlistObj',
  }),
  objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RAW_JSON,
  name: 'shortlistObj',
  label: 'shortlistObj',
});
