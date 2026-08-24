import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  SHORTLIST_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const CV_SENT_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

export default defineObject({
  universalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'cvSent',
  namePlural: 'cvSents',
  labelSingular: 'CV Sent',
  labelPlural: 'CV Sents',
  icon: 'IconSend',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    CV_SENT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: CV_SENT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'shortlists',
      }),
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
          name: 'cvSents',
        }),
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'cvSents',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'candidateId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: CV_SENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'project',
      }),
      type: FieldType.RELATION,
      name: 'project',
      label: 'Project',
      icon: 'IconTie',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'cvSents',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'projectId',
      },
    },
  ],
});
