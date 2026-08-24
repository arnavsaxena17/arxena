import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

const personObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier;

export default defineField({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: personObjectUniversalIdentifier,
    name: 'phoneCall',
  }),
  objectUniversalIdentifier: personObjectUniversalIdentifier,
  type: FieldType.RELATION,
  name: 'phoneCall',
  label: 'PhoneCall',
  icon: 'IconPhone',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier:
    PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    getLegacyFieldUniversalIdentifier({
      objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
      name: 'person',
    }),
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
