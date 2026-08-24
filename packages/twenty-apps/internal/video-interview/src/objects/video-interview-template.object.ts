import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const VIDEO_INTERVIEW_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier:
      VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

export default defineObject({
  universalIdentifier: VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'videoInterviewTemplate',
  namePlural: 'videoInterviewTemplates',
  labelSingular: 'Video Interview Template',
  labelPlural: 'Video Interview Templates',
  description: 'Per-project template of intro, instructions, and questions',
  icon: 'IconScan',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        VIDEO_INTERVIEW_TEMPLATE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'introduction',
      }),
      type: FieldType.TEXT,
      name: 'introduction',
      label: 'Introduction',
      description: 'Additional Points to be added in introduction',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'instructions',
      }),
      type: FieldType.TEXT,
      name: 'instructions',
      label: 'Instructions',
      description: 'Additional Instructions',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterviewTemplate',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'projectId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterviewModel',
      }),
      type: FieldType.RELATION,
      name: 'videoInterviewModel',
      label: 'Video Interview Model',
      icon: 'IconMessageChatbot',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier:
            VIDEO_INTERVIEW_MODEL_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'videoInterviewTemplate',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'videoInterviewModelId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterviewQuestions',
      }),
      type: FieldType.RELATION,
      name: 'videoInterviewQuestions',
      label: 'Video Interview Questions',
      icon: 'IconQuestionMark',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier:
            VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'videoInterviewTemplate',
        }),
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterview',
      }),
      type: FieldType.RELATION,
      name: 'videoInterview',
      label: 'Video Interview',
      icon: 'IconActivity',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier:
            VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'videoInterviewTemplate',
        }),
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
