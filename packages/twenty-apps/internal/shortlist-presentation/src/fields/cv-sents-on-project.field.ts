import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'cvSents',
  }),
  objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'cvSents',
  label: 'CVSents',
  icon: 'IconSend',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'project',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
