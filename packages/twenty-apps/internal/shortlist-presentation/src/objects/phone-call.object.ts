import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  getLegacySelectOptionUniversalIdentifier,
  PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const PHONE_CALL_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

const callTypeFieldUniversalIdentifier = getLegacyFieldUniversalIdentifier({
  objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'callType',
});

const personObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier;

export default defineObject({
  universalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'phoneCall',
  namePlural: 'phoneCalls',
  labelSingular: 'Phone Call',
  labelPlural: 'Phone Calls',
  icon: 'IconPhone',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    PHONE_CALL_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: PHONE_CALL_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: callTypeFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'callType',
      label: 'Call Type',
      icon: 'IconPhoneCall',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: callTypeFieldUniversalIdentifier,
            value: 'INCOMING',
          }),
          color: 'green',
          label: 'Incoming',
          position: 0,
          value: 'INCOMING',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: callTypeFieldUniversalIdentifier,
            value: 'OUTGOING',
          }),
          color: 'turquoise',
          label: 'Outgoing',
          position: 1,
          value: 'OUTGOING',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: callTypeFieldUniversalIdentifier,
            value: 'MISSED',
          }),
          color: 'sky',
          label: 'Missed',
          position: 2,
          value: 'MISSED',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: callTypeFieldUniversalIdentifier,
            value: 'REJECTED',
          }),
          color: 'sky',
          label: 'Rejected',
          position: 3,
          value: 'REJECTED',
        },
      ],
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: PHONE_CALL_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'person',
      }),
      type: FieldType.RELATION,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        personObjectUniversalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: personObjectUniversalIdentifier,
          name: 'phoneCall',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
    },
  ],
});
