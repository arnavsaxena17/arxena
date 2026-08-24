import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
} from 'twenty-sdk/define';

import {
  CANDIDATE_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_RESPONSE_OBJECT_UNIVERSAL_IDENTIFIER,
  VIDEO_INTERVIEW_TEMPLATE_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const VIDEO_INTERVIEW_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

export default defineObject({
  universalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'videoInterview',
  namePlural: 'videoInterviews',
  labelSingular: 'Video Interview',
  labelPlural: 'Video Interviews',
  icon: 'IconActivity',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    VIDEO_INTERVIEW_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: VIDEO_INTERVIEW_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'interviewLink',
      }),
      type: FieldType.LINKS,
      name: 'interviewLink',
      label: 'Interview Link',
      description: 'Link Shared with the candidate',
      icon: 'IconLink',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'interviewReviewLink',
      }),
      type: FieldType.LINKS,
      name: 'interviewReviewLink',
      label: 'Interview Review Link',
      description: 'Link with Interview Review',
      icon: 'IconLink',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'interviewStarted',
      }),
      type: FieldType.BOOLEAN,
      name: 'interviewStarted',
      label: 'Interview Started',
      description: 'Interview Started or Not',
      icon: 'IconAdjustmentsQuestion',
      defaultValue: false,
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'interviewCompleted',
      }),
      type: FieldType.BOOLEAN,
      name: 'interviewCompleted',
      label: 'Interview Completed',
      description: 'Interview Completed or Not',
      icon: 'IconAdjustmentsCheck',
      defaultValue: false,
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterview',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'videoInterviewTemplateId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterview',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'candidateId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: VIDEO_INTERVIEW_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'videoInterview',
        }),
      universalSettings: {
        relationType: RelationType.ONE_TO_MANY,
      },
    },
  ],
});
