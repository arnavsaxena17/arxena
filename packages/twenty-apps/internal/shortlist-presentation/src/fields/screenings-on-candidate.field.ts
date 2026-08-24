import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'screenings',
  }),
  objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'screenings',
  label: 'Screenings',
  icon: 'IconScreenShare',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'candidate',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
