import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const VIDEO_INTERVIEW_RESPONSE_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier:
      VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

export default defineObject({
  universalIdentifier: VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'videoInterviewResponse',
  namePlural: 'videoInterviewResponses',
  labelSingular: 'Video Interview Response',
  labelPlural: 'Video Interview Responses',
  icon: 'IconPencilDown',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_RESPONSE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        VIDEO_INTERVIEW_RESPONSE_NAME_FIELD_UNIVERSAL_IDENTIFIER,
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
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'startedResponding',
      }),
      type: FieldType.BOOLEAN,
      name: 'startedResponding',
      label: 'Started Responding',
      description: 'Whether the candidate has started responding or not',
      icon: 'IconLocationQuestion',
      defaultValue: false,
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'completedResponse',
      }),
      type: FieldType.BOOLEAN,
      name: 'completedResponse',
      label: 'Completed Response',
      description: 'Whether the canadidate has completed responding or not',
      icon: 'IconLocationCheck',
      defaultValue: false,
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'timer',
      }),
      type: FieldType.TEXT,
      name: 'timer',
      label: 'Timer',
      description: 'Total Time',
      icon: 'IconDeviceWatchPause',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'timeLimitAdherence',
      }),
      type: FieldType.BOOLEAN,
      name: 'timeLimitAdherence',
      label: 'Time Limit Adherence',
      description: 'Time Adherence',
      icon: 'IconTimeDuration30',
      defaultValue: false,
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'transcript',
      }),
      type: FieldType.TEXT,
      name: 'transcript',
      label: 'Transcript',
      description: 'Transcript of the Response',
      icon: 'IconFileTextAI',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'feedback',
      }),
      type: FieldType.TEXT,
      name: 'feedback',
      label: 'Feedback',
      description: 'Feedback for the Response',
      icon: 'IconPencilStar',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'videoInterviewQuestion',
      }),
      type: FieldType.RELATION,
      name: 'videoInterviewQuestion',
      label: 'Video Interview Question',
      icon: 'IconQuestionMark',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier:
            VIDEO_INTERVIEW_QUESTION_OBJECT_UNIVERSAL_IDENTIFIER,
          name: 'videoInterviewResponse',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'videoInterviewQuestionId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterviewResponse',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'videoInterviewId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterviewResponse',
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
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterviewResponse',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'candidateId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'person',
      }),
      type: FieldType.RELATION,
      name: 'person',
      label: 'Person',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier:
            STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
          name: 'videoInterviewResponse',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'personId',
      },
    },
  ],
});
