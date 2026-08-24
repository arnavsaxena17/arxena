import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'assistantThreads',
  }),
  objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'assistantThreads',
  label: 'Assistant Threads',
  icon: 'IconMessage',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'project',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
