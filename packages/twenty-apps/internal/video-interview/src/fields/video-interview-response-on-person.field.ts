import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const personObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier;

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: personObjectUniversalIdentifier,
    name: 'videoInterviewResponse',
  }),
  objectUniversalIdentifier: personObjectUniversalIdentifier,
  type: FieldType.RELATION,
  name: 'videoInterviewResponse',
  label: 'Video Interview Response',
  icon: 'IconPencil',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier:
        VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'person',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
