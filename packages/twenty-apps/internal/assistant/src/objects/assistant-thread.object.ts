import {
  defineObject,
  FieldType,
  OnDeleteAction,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
  getLegacyFieldUniversalIdentifier,
  getLegacySelectOptionUniversalIdentifier,
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/legacy-identifiers';

export const ASSISTANT_THREAD_NAME_FIELD_UNIVERSAL_IDENTIFIER =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'name',
  });

const assistantModeFieldUniversalIdentifier =
  getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
    name: 'assistantMode',
  });

const workspaceMemberObjectUniversalIdentifier =
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.workspaceMember.universalIdentifier;

const rawJsonField = (name: string, label: string, description: string) => ({
  universalIdentifier: getLegacyFieldUniversalIdentifier({
    objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
    name,
  }),
  type: FieldType.RAW_JSON,
  name,
  label,
  description,
});

export default defineObject({
  universalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'assistantThread',
  namePlural: 'assistantThreads',
  labelSingular: 'Assistant Thread',
  labelPlural: 'Assistant Threads',
  icon: 'IconMessage',
  isSearchable: true,
  isUICreatable: true,
  isUIEditable: true,
  labelIdentifierFieldMetadataUniversalIdentifier:
    ASSISTANT_THREAD_NAME_FIELD_UNIVERSAL_IDENTIFIER,
  fields: [
    {
      universalIdentifier: ASSISTANT_THREAD_NAME_FIELD_UNIVERSAL_IDENTIFIER,
      type: FieldType.TEXT,
      name: 'name',
      label: 'Name',
      icon: 'IconAbc',
      isNullable: false,
      defaultValue: "''",
    },
    rawJsonField('messages', 'Messages', ''),
    rawJsonField('lastTableData', 'Last Table Data', ''),
    rawJsonField(
      'agentNotes',
      'Agent Notes',
      'Agent scratch pad / pending notes for this thread (JSON array of { summary, createdAt? })',
    ),
    rawJsonField(
      'agentEvents',
      'Agent Events',
      'Assistant agent events for this thread (JSON array of { status, summary?, error?, toolName?, runId?, timestamp })',
    ),
    {
      universalIdentifier: assistantModeFieldUniversalIdentifier,
      type: FieldType.SELECT,
      name: 'assistantMode',
      label: 'Assistant Mode',
      description:
        'Controls whether this assistant thread runs in fully autonomous or permissioned (human approval) mode',
      defaultValue: "'PERMISSIONED'",
      options: [
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: assistantModeFieldUniversalIdentifier,
            value: 'FULLY_AUTONOMOUS',
          }),
          color: 'green',
          label: 'Fully autonomous',
          position: 0,
          value: 'FULLY_AUTONOMOUS',
        },
        {
          id: getLegacySelectOptionUniversalIdentifier({
            fieldUniversalIdentifier: assistantModeFieldUniversalIdentifier,
            value: 'PERMISSIONED',
          }),
          color: 'blue',
          label: 'Permissioned',
          position: 1,
          value: 'PERMISSIONED',
        },
      ],
    },
    rawJsonField(
      'assistantParameters',
      'Assistant Parameters',
      'Search/assistant parameters for this thread (generated and resolved search parameters)',
    ),
    rawJsonField(
      'enrichmentConfigs',
      'Enrichment Configs',
      'Enrichment configurations for this thread',
    ),
    rawJsonField(
      'columnFilters',
      'Column Filters',
      'Column filters for candidate filtering',
    ),
    rawJsonField(
      'assistantSearchStrategy',
      'Assistant Search Strategy',
      'Search strategy for this thread',
    ),
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'isActive',
      }),
      type: FieldType.BOOLEAN,
      name: 'isActive',
      label: 'Is Active',
      description: 'Whether this thread is currently active',
      defaultValue: false,
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'assistantThreads',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'recruiterId',
      },
    },
    {
      universalIdentifier: getLegacyFieldUniversalIdentifier({
        objectUniversalIdentifier: ASSISTANT_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
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
          name: 'assistantThreads',
        }),
      universalSettings: {
        relationType: RelationType.MANY_TO_ONE,
        onDelete: OnDeleteAction.SET_NULL,
        joinColumnName: 'projectId',
      },
    },
  ],
});
