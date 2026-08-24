import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'videoInterviewTemplate',
  }),
  objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'videoInterviewTemplate',
  label: 'Video Interview Template',
  icon: 'IconScan',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier:
        VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'project',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
