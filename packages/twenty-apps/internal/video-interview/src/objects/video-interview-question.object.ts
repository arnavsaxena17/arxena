import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  getLegacyFieldUniversalIdentifier,
  getLegacySelectOptionUniversalIdentifier,
  VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const VIDEO_INTERVIEW_QUESTION_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier:
      VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

const questionTypeFieldUniversalIdentifier = getLegacyFieldUniversalIdentifier({
  objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'questionType',
});

const answerTypeFieldUniversalIdentifier = getLegacyFieldUniversalIdentifier({
  objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'answerType',
});

const retakesFieldUniversalIdentifier = getLegacyFieldUniversalIdentifier({
  objectUniversalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  name: 'retakes',
});

export default defineObject({
  universalIdentifier: VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'videoInterviewQuestion',
  namePlural: 'videoInterviewQuestions',
  labelSingular: 'Video Interview Question',
  labelPlural: 'Video Interview Questions',
  icon: 'IconQuestionMark',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_QUESTION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        VIDEO_INTERVIEW_QUESTION_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: questionTypeFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'questionType',
      label: 'Question Type',
      description: 'Video or Text based Interview',
      icon: 'IconAdjustmentsQuestion',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: questionTypeFieldUniversalIdentifier,
            value: 'VIDEO',
          }),
          color: 'green',
          label: 'Video',
          position: 0,
          value: 'VIDEO',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: questionTypeFieldUniversalIdentifier,
            value: 'TEXT',
          }),
          color: 'turquoise',
          label: 'Test (No Model)',
          position: 1,
          value: 'TEXT',
        },
      ],
    },
    {
      universalIdentifier: answerTypeFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'answerType',
      label: 'Answer Type',
      icon: 'IconCameraQuestion',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: answerTypeFieldUniversalIdentifier,
            value: 'VIDEO',
          }),
          color: 'green',
          label: 'Video (Real Time Recording)',
          position: 0,
          value: 'VIDEO',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: answerTypeFieldUniversalIdentifier,
            value: 'TEXT',
          }),
          color: 'turquoise',
          label: 'Test (No Recording)',
          position: 1,
          value: 'TEXT',
        },
      ],
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'timeLimit',
      }),
      type: FieldType.NUMBER,
      name: 'timeLimit',
      label: 'Time Limit',
      description: 'Time Limit of Recording',
      icon: 'IconTimeDuration30',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'questionValue',
      }),
      type: FieldType.TEXT,
      name: 'questionValue',
      label: 'Question Value',
      description: 'The Question',
      icon: 'IconQuestion',
    },
    {
      universalIdentifier: retakesFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'retakes',
      label: 'Retakes',
      description: 'No. of Retakes allowed in case of answer type video',
      icon: 'IconReload',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: retakesFieldUniversalIdentifier,
            value: 'ZERO',
          }),
          color: 'green',
          label: '0',
          position: 0,
          value: 'ZERO',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: retakesFieldUniversalIdentifier,
            value: 'ONE',
          }),
          color: 'turquoise',
          label: '1',
          position: 1,
          value: 'ONE',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: retakesFieldUniversalIdentifier,
            value: 'TWO',
          }),
          color: 'sky',
          label: '2',
          position: 2,
          value: 'TWO',
        },
      ],
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterviewTemplate',
      }),
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
          name: 'videoInterviewQuestions',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'videoInterviewTemplateId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterviewResponse',
      }),
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
          name: 'videoInterviewQuestion',
        }),
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
