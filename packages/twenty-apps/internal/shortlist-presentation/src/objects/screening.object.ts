import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const SCREENING_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

export default defineObject({
  universalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'screening',
  namePlural: 'screenings',
  labelSingular: 'Screening',
  labelPlural: 'Screenings',
  icon: 'IconUserSearch',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    SCREENING_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: SCREENING_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: SCREENING_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'candidate',
      }),
      type: FieldType.RELATION,
      name: 'candidate',
      label: 'Candidate',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'screenings',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'candidateId',
      },
    },
  ],
});
