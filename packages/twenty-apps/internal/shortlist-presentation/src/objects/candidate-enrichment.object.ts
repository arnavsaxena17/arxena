import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  getLegacySelectOptionUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const CANDIDATE_ENRICHMENT_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier:
      CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

const selectedModelFieldUniversalIdentifier =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier:
      CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'selectedModel',
  });

const workspaceMemberObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier;

export default defineObject({
  universalIdentifier: CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'candidateEnrichment',
  namePlural: 'candidateEnrichments',
  labelSingular: 'AI Filter',
  labelPlural: 'AI Filters',
  icon: 'IconFilterSearch',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    CANDIDATE_ENRICHMENT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier:
        CANDIDATE_ENRICHMENT_NAME_FIELD_UNIVERSAL_IDENTIFIER,
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
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'selectedMetadataFields',
      }),
      type: FieldType.RAW_JSON,
      name: 'selectedMetadataFields',
      label: 'selectedMetadataFields',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'modelName',
      }),
      type: FieldType.TEXT,
      name: 'modelName',
      label: 'modelName',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'filterDescription',
      }),
      type: FieldType.TEXT,
      name: 'filterDescription',
      label: 'filterDescription',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'filterFields',
      }),
      type: FieldType.RAW_JSON,
      name: 'filterFields',
      label: 'Filter Fields',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'sampleJson',
      }),
      type: FieldType.RAW_JSON,
      name: 'sampleJson',
      label: 'sampleJson',
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'prompt',
      }),
      type: FieldType.TEXT,
      name: 'prompt',
      label: 'prompt',
    },
    {
      universalIdentifier: selectedModelFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'selectedModel',
      label: 'selectedModel',
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: selectedModelFieldUniversalIdentifier,
            value: 'GPT35TURBO',
          }),
          color: 'green',
          label: 'gpt-3.5-turbo',
          position: 0,
          value: 'GPT35TURBO',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: selectedModelFieldUniversalIdentifier,
            value: 'GPT4O',
          }),
          color: 'turquoise',
          label: 'gpt-4o',
          position: 1,
          value: 'GPT4O',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: selectedModelFieldUniversalIdentifier,
            value: 'GPT4OMINI',
          }),
          color: 'turquoise',
          label: 'gpt-4o-mini',
          position: 2,
          value: 'GPT4OMINI',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: selectedModelFieldUniversalIdentifier,
            value: 'GPT4OMINISEARCHPREVIEW',
          }),
          color: 'turquoise',
          label: 'gpt-4o-mini-search-preview',
          position: 3,
          value: 'GPT4OMINISEARCHPREVIEW',
        },
      ],
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier:
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'candidateEnrichments',
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
          CANDIDATE_ENRICHMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'recruiter',
      }),
      type: FieldType.RELATION,
      name: 'recruiter',
      label: 'Recruiter',
      icon: 'IconUser',
      isNullable: true,
      relationTargetObjectMetadataUniversalIdentifier:
        workspaceMemberObjectUniversalIdentifier,
      relationTargetFieldMetadataUniversalIdentifier:
        getLegacyFieldUniversalIdentifier({
          objectUniversalIdentifier: workspaceMemberObjectUniversalIdentifier,
          name: 'candidateEnrichment',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'recruiterId',
      },
    },
  ],
});
