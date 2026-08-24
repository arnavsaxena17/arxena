import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'videoInterview',
  }),
  objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'videoInterview',
  label: 'Video Interview',
  icon: 'IconActivity',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'candidate',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
