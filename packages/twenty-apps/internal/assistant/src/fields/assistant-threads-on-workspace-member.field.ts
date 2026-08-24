import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
} from 'src/constants/legacy-identifiers';

const workspaceMemberObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier;

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: workspaceMemberObjectUniversalIdentifier,
    name: 'assistantThreads',
  }),
  objectUniversalIdentifier: workspaceMemberObjectUniversalIdentifier,
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
      name: 'recruiter',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
