import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'shortlists',
  }),
  objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'shortlists',
  label: 'Shortlists',
  icon: 'IconListCheck',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'candidate',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
