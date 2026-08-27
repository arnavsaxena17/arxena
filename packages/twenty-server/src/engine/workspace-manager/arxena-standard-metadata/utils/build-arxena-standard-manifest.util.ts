import {
  type FieldManifest,
  type Manifest,
  type ObjectFieldManifest,
  type ObjectManifest,
  type PageLayoutManifest,
  type RegularFieldManifest,
  type RelationFieldManifest,
  type ViewManifest,
  getFieldUniversalIdentifier,
  getFieldsWidgetViewUniversalIdentifier,
  getIndexViewUniversalIdentifier,
  getObjectNavigationMenuItemUniversalIdentifier,
  getObjectUniversalIdentifier,
  getPageLayoutTabUniversalIdentifier,
  getPageLayoutWidgetUniversalIdentifier,
  getRecordPageLayoutUniversalIdentifier,
  getSelectOptionUniversalIdentifier,
  getViewFieldUniversalIdentifier,
} from 'twenty-shared/application';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import {
  FieldMetadataType,
  NavigationMenuItemType,
  RelationOnDeleteAction,
  RelationType,
  ViewKey,
  ViewType,
  type FieldMetadataOptions,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type ArxenaFieldDefinition } from 'src/engine/workspace-manager/arxena-standard-metadata/data/arxena-metadata-types';
import {
  getAssistantFieldsData,
  getFieldsData,
  getShortlistPresentationFieldsData,
  getVideoInterviewFieldsData,
} from 'src/engine/workspace-manager/arxena-standard-metadata/data/fields-data';
import {
  getAssistantObjectCreationArr,
  getObjectCreationArr,
  getShortlistPresentationObjectCreationArr,
  getVideoInterviewObjectCreationArr,
} from 'src/engine/workspace-manager/arxena-standard-metadata/data/objects-data';
import {
  getAssistantRelationsData,
  getRelationsData,
  getShortlistPresentationRelationsData,
  getVideoInterviewRelationsData,
} from 'src/engine/workspace-manager/arxena-standard-metadata/data/relations-data';
import {
  ARXENA_STANDARD_APPLICATION,
  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';
import { buildGtmCommandDashboardPageLayout } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-gtm-command-dashboard-page-layout.util';
import { ASSISTANT_APPLICATION } from 'src/engine/workspace-manager/assistant-application/constants/assistant-application.constant';
import { SHORTLIST_PRESENTATION_APPLICATION } from 'src/engine/workspace-manager/shortlist-presentation-application/constants/shortlist-presentation-application.constant';
import { VIDEO_INTERVIEW_APPLICATION } from 'src/engine/workspace-manager/video-interview-application/constants/video-interview-application.constant';
import {
  GRID_POSITIONS,
  TAB_PROPS,
  WIDGET_PROPS,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-page-layout-tabs.template';

const EMPTY_OBJECTS_NAME_ID_MAP: Record<string, string> = {};

const isStandardObjectName = (
  nameSingular: string,
): nameSingular is keyof typeof STANDARD_OBJECTS =>
  nameSingular in STANDARD_OBJECTS;

const isVideoInterviewHostObjectName = (nameSingular: string): boolean =>
  nameSingular === 'candidate' ||
  nameSingular === 'project' ||
  nameSingular === 'person';

const isShortlistPresentationHostObjectName = (
  nameSingular: string,
): boolean =>
  nameSingular === 'candidate' ||
  nameSingular === 'project' ||
  nameSingular === 'person' ||
  nameSingular === 'workspaceMember';

const isAssistantHostObjectName = (nameSingular: string): boolean =>
  nameSingular === 'project' || nameSingular === 'workspaceMember';

type ArxenaFamilyManifestOwner =
  | 'arxena-standard'
  | 'video-interview'
  | 'shortlist-presentation'
  | 'assistant';

// Renames that must keep the pre-rename deterministic UID so sync updates
// existing workspace objects/tables in place instead of creating duplicates.
const ARXENA_OBJECT_UNIVERSAL_IDENTIFIER_LEGACY_NAME_SINGULAR: Record<
  string,
  string
> = {
  workspaceProfile: 'gtmWorkspaceProfile',
  chatMessage: 'whatsappMessage',
};

// Field names used for UID hashing when the live field name changed.
const ARXENA_FIELD_UNIVERSAL_IDENTIFIER_LEGACY_NAME: Record<string, string> = {
  'chatMessage:externalMessageId': 'whatsappMessageId',
  'candidate:chatMessages': 'whatsappMessages',
  'person:chatMessages': 'whatsappMessages',
  'project:chatMessages': 'whatsappMessages',
  'workspaceMember:chatMessages': 'whatsappMessages',
};

const resolveFieldNameForUniversalIdentifier = (
  objectName: string,
  fieldName: string,
): string =>
  ARXENA_FIELD_UNIVERSAL_IDENTIFIER_LEGACY_NAME[`${objectName}:${fieldName}`] ??
  fieldName;

const resolveObjectUniversalIdentifier = (nameSingular: string): string => {
  if (isStandardObjectName(nameSingular)) {
    return STANDARD_OBJECTS[nameSingular].universalIdentifier;
  }

  const legacyNameSingular =
    ARXENA_OBJECT_UNIVERSAL_IDENTIFIER_LEGACY_NAME_SINGULAR[nameSingular];

  return getObjectUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    nameSingular: legacyNameSingular ?? nameSingular,
  });
};

const standardObjectAlreadyHasField = ({
  objectName,
  fieldName,
}: {
  objectName: string;
  fieldName: string;
}): boolean => {
  if (!isStandardObjectName(objectName)) {
    return false;
  }

  return fieldName in STANDARD_OBJECTS[objectName].fields;
};

const buildNameFieldManifest = ({
  objectUniversalIdentifier,
}: {
  objectUniversalIdentifier: string;
}): ObjectFieldManifest => {
  const universalIdentifier = getFieldUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier,
    name: 'name',
  });

  return {
    universalIdentifier,
    type: FieldMetadataType.TEXT,
    name: 'name',
    label: 'Name',
    icon: 'IconAbc',
    isNullable: false,
    defaultValue: "''",
  };
};

const buildScalarFieldManifest = ({
  objectName,
  field,
}: {
  objectName: string;
  field: ArxenaFieldDefinition;
}): RegularFieldManifest => {
  const objectUniversalIdentifier =
    resolveObjectUniversalIdentifier(objectName);
  const universalIdentifier = getFieldUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier,
    name: resolveFieldNameForUniversalIdentifier(objectName, field.name),
  });

  // Always use optionIndex — source data often sets every option to position 0
  const options = field.options?.map((option, optionIndex) => ({
    id: getSelectOptionUniversalIdentifier({
      applicationUniversalIdentifier:
        ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier: universalIdentifier,
      value: option.value,
    }),
    position: optionIndex,
    label: option.label,
    value: option.value,
    ...(option.color != null && { color: option.color }),
  }));

  return {
    universalIdentifier,
    objectUniversalIdentifier,
    type: field.type as Exclude<
      FieldMetadataType,
      FieldMetadataType.RELATION | FieldMetadataType.MORPH_RELATION
    >,
    name: field.name,
    label: field.label,
    description: field.description || undefined,
    icon: field.icon || undefined,
    isNullable: field.isNullable ?? true,
    ...(field.isUnique === true && { isUnique: true }),
    ...(field.defaultValue !== undefined && {
      defaultValue: field.defaultValue as RegularFieldManifest['defaultValue'],
    }),
    ...(isDefined(options) && {
      options: options as FieldMetadataOptions,
    }),
  } as RegularFieldManifest;
};

const toObjectFieldManifest = (
  fieldManifest: RegularFieldManifest,
): ObjectFieldManifest => {
  const { objectUniversalIdentifier: _objectUniversalIdentifier, ...rest } =
    fieldManifest;

  return rest as ObjectFieldManifest;
};

const buildRelationFieldManifest = ({
  objectName,
  fieldName,
  label,
  description,
  icon,
  relationType,
  targetObjectName,
  targetFieldName,
}: {
  objectName: string;
  fieldName: string;
  label: string;
  description?: string | null;
  icon?: string;
  relationType: RelationType;
  targetObjectName: string;
  targetFieldName: string;
}): RelationFieldManifest => {
  const objectUniversalIdentifier =
    resolveObjectUniversalIdentifier(objectName);
  const targetObjectUniversalIdentifier =
    resolveObjectUniversalIdentifier(targetObjectName);
  const universalIdentifier = getFieldUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier,
    name: resolveFieldNameForUniversalIdentifier(objectName, fieldName),
  });
  const relationTargetFieldMetadataUniversalIdentifier =
    getFieldUniversalIdentifier({
      applicationUniversalIdentifier:
        ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: targetObjectUniversalIdentifier,
      name: resolveFieldNameForUniversalIdentifier(
        targetObjectName,
        targetFieldName,
      ),
    });

  return {
    universalIdentifier,
    objectUniversalIdentifier,
    type: FieldMetadataType.RELATION,
    name: fieldName,
    label,
    description: description || undefined,
    icon: icon || undefined,
    isNullable: true,
    relationTargetObjectMetadataUniversalIdentifier:
      targetObjectUniversalIdentifier,
    relationTargetFieldMetadataUniversalIdentifier,
    universalSettings:
      relationType === RelationType.MANY_TO_ONE
        ? {
            relationType,
            onDelete: RelationOnDeleteAction.SET_NULL,
            joinColumnName: `${fieldName}Id`,
          }
        : {
            relationType,
          },
  };
};

const buildDefaultViewsForObject = ({
  objectUniversalIdentifier,
  labelIdentifierFieldUniversalIdentifier,
  fieldUniversalIdentifiers,
}: {
  objectUniversalIdentifier: string;
  labelIdentifierFieldUniversalIdentifier: string;
  fieldUniversalIdentifiers: string[];
}): ViewManifest[] => {
  const indexViewUniversalIdentifier = getIndexViewUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier,
  });

  const recordPageLayoutUniversalIdentifier =
    getRecordPageLayoutUniversalIdentifier({
      applicationUniversalIdentifier:
        ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier,
    });
  const homeTabUniversalIdentifier = getPageLayoutTabUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    pageLayoutUniversalIdentifier: recordPageLayoutUniversalIdentifier,
    title: TAB_PROPS.home.title,
  });
  const fieldsWidgetUniversalIdentifier =
    getPageLayoutWidgetUniversalIdentifier({
      applicationUniversalIdentifier:
        ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
      pageLayoutTabUniversalIdentifier: homeTabUniversalIdentifier,
      title: WIDGET_PROPS.fields.title,
    });
  const fieldsViewUniversalIdentifier = getFieldsWidgetViewUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    pageLayoutWidgetUniversalIdentifier: fieldsWidgetUniversalIdentifier,
  });

  const buildViewFields = (
    viewUniversalIdentifier: string,
    includeLabelIdentifier: boolean,
  ) => {
    const viewFieldUniversalIdentifiers = includeLabelIdentifier
      ? [labelIdentifierFieldUniversalIdentifier, ...fieldUniversalIdentifiers]
      : fieldUniversalIdentifiers;

    return viewFieldUniversalIdentifiers.map(
      (fieldMetadataUniversalIdentifier, position) => ({
        universalIdentifier: getViewFieldUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          viewUniversalIdentifier,
          fieldMetadataUniversalIdentifier,
        }),
        fieldMetadataUniversalIdentifier,
        position,
        isVisible: true,
        size: 100,
      }),
    );
  };

  return [
    {
      universalIdentifier: indexViewUniversalIdentifier,
      name: 'All {objectLabelPlural}',
      objectUniversalIdentifier,
      type: ViewType.TABLE,
      key: ViewKey.INDEX,
      icon: 'IconList',
      position: 0,
      fields: buildViewFields(indexViewUniversalIdentifier, true),
    },
    {
      universalIdentifier: fieldsViewUniversalIdentifier,
      name: 'Record page fields',
      objectUniversalIdentifier,
      type: ViewType.TABLE,
      icon: 'IconList',
      position: 1,
      fields: buildViewFields(fieldsViewUniversalIdentifier, false),
    },
  ];
};

const buildDefaultRecordPageLayout = ({
  objectUniversalIdentifier,
  labelSingular,
  fieldsViewUniversalIdentifier,
}: {
  objectUniversalIdentifier: string;
  labelSingular: string;
  fieldsViewUniversalIdentifier: string;
}): PageLayoutManifest => {
  const pageLayoutUniversalIdentifier = getRecordPageLayoutUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier,
  });

  const tabDefinitions = [
    { key: 'home' as const, widgetKey: 'fields' as const },
    { key: 'timeline' as const, widgetKey: 'timeline' as const },
    { key: 'tasks' as const, widgetKey: 'tasks' as const },
    { key: 'notes' as const, widgetKey: 'notes' as const },
    { key: 'files' as const, widgetKey: 'files' as const },
  ];

  return {
    universalIdentifier: pageLayoutUniversalIdentifier,
    name: `Default ${labelSingular} Layout`,
    type: 'RECORD_PAGE',
    objectUniversalIdentifier,
    tabs: tabDefinitions.map(({ key, widgetKey }) => {
      const tabProps = TAB_PROPS[key];
      const widgetProps = WIDGET_PROPS[widgetKey];
      const tabUniversalIdentifier = getPageLayoutTabUniversalIdentifier({
        applicationUniversalIdentifier:
          ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        pageLayoutUniversalIdentifier,
        title: tabProps.title,
      });
      const widgetUniversalIdentifier = getPageLayoutWidgetUniversalIdentifier({
        applicationUniversalIdentifier:
          ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        pageLayoutTabUniversalIdentifier: tabUniversalIdentifier,
        title: widgetProps.title,
      });
      const isFieldsWidget = widgetKey === 'fields';

      return {
        universalIdentifier: tabUniversalIdentifier,
        title: tabProps.title,
        position: tabProps.position,
        icon: tabProps.icon,
        layoutMode: tabProps.layoutMode,
        pageLayoutUniversalIdentifier,
        widgets: [
          {
            universalIdentifier: widgetUniversalIdentifier,
            title: widgetProps.title,
            type: widgetProps.type,
            objectUniversalIdentifier,
            gridPosition: GRID_POSITIONS.FULL_WIDTH,
            configuration: isFieldsWidget
              ? {
                  configurationType: 'FIELDS' as const,
                  viewUniversalIdentifier: fieldsViewUniversalIdentifier,
                  newFieldDefaultVisibility: true,
                }
              : {
                  configurationType: widgetKey.toUpperCase() as
                    | 'TIMELINE'
                    | 'TASKS'
                    | 'NOTES'
                    | 'FILES',
                },
          },
        ],
      };
    }),
  };
};

export const buildArxenaStandardManifest = (
  isOrgChartEnabled?: boolean,
): Manifest =>
  buildArxenaFamilyManifest({
    owner: 'arxena-standard',
    isOrgChartEnabled,
  });

export const buildVideoInterviewManifest = (
  isOrgChartEnabled?: boolean,
): Manifest =>
  buildArxenaFamilyManifest({
    owner: 'video-interview',
    isOrgChartEnabled,
  });

export const buildShortlistPresentationManifest = (
  isOrgChartEnabled?: boolean,
): Manifest =>
  buildArxenaFamilyManifest({
    owner: 'shortlist-presentation',
    isOrgChartEnabled,
  });

export const buildAssistantManifest = (
  isOrgChartEnabled?: boolean,
): Manifest =>
  buildArxenaFamilyManifest({
    owner: 'assistant',
    isOrgChartEnabled,
  });

const buildArxenaFamilyManifest = ({
  owner,
  isOrgChartEnabled,
}: {
  owner: ArxenaFamilyManifestOwner;
  isOrgChartEnabled?: boolean;
}): Manifest => {
  const objectDefinitions =
    owner === 'video-interview'
      ? getVideoInterviewObjectCreationArr()
      : owner === 'shortlist-presentation'
        ? getShortlistPresentationObjectCreationArr()
        : owner === 'assistant'
          ? getAssistantObjectCreationArr()
          : getObjectCreationArr(isOrgChartEnabled);
  const fieldsData =
    owner === 'video-interview'
      ? getVideoInterviewFieldsData(
          EMPTY_OBJECTS_NAME_ID_MAP,
          isOrgChartEnabled,
        )
      : owner === 'shortlist-presentation'
        ? getShortlistPresentationFieldsData(
            EMPTY_OBJECTS_NAME_ID_MAP,
            isOrgChartEnabled,
          )
        : owner === 'assistant'
          ? getAssistantFieldsData(
              EMPTY_OBJECTS_NAME_ID_MAP,
              isOrgChartEnabled,
            )
          : getFieldsData(EMPTY_OBJECTS_NAME_ID_MAP, isOrgChartEnabled);
  const relationsData =
    owner === 'video-interview'
      ? getVideoInterviewRelationsData(
          EMPTY_OBJECTS_NAME_ID_MAP,
          isOrgChartEnabled,
        )
      : owner === 'shortlist-presentation'
        ? getShortlistPresentationRelationsData(
            EMPTY_OBJECTS_NAME_ID_MAP,
            isOrgChartEnabled,
          )
        : owner === 'assistant'
          ? getAssistantRelationsData(
              EMPTY_OBJECTS_NAME_ID_MAP,
              isOrgChartEnabled,
            )
          : getRelationsData(EMPTY_OBJECTS_NAME_ID_MAP, isOrgChartEnabled);

  const arxenaObjectNames = new Set(
    objectDefinitions.map(
      (objectDefinition) => objectDefinition.object.nameSingular,
    ),
  );

  const scalarFieldsByObjectName = fieldsData.reduce<
    Map<string, ArxenaFieldDefinition[]>
  >((accumulator, fieldWithObject) => {
    const existing = accumulator.get(fieldWithObject.objectName) ?? [];

    existing.push(fieldWithObject.field);
    accumulator.set(fieldWithObject.objectName, existing);

    return accumulator;
  }, new Map());

  const objects: ObjectManifest[] = [];
  const topLevelFields: FieldManifest[] = [];
  const views: ViewManifest[] = [];
  const pageLayouts: PageLayoutManifest[] = [];
  const navigationMenuItems: Manifest['navigationMenuItems'] = [];

  for (const [objectIndex, objectDefinition] of objectDefinitions.entries()) {
    const { object } = objectDefinition;
    const objectUniversalIdentifier = resolveObjectUniversalIdentifier(
      object.nameSingular,
    );
    const nameField = buildNameFieldManifest({ objectUniversalIdentifier });
    const objectScalarFields =
      scalarFieldsByObjectName.get(object.nameSingular) ?? [];

    const nestedScalarFieldManifests = objectScalarFields.map((field) =>
      toObjectFieldManifest(
        buildScalarFieldManifest({
          objectName: object.nameSingular,
          field,
        }),
      ),
    );

    objects.push({
      universalIdentifier: objectUniversalIdentifier,
      nameSingular: object.nameSingular,
      namePlural: object.namePlural,
      labelSingular: object.labelSingular,
      labelPlural: object.labelPlural,
      description: object.description || undefined,
      icon: object.icon || undefined,
      isSearchable: true,
      isUICreatable: true,
      isUIEditable: true,
      labelIdentifierFieldMetadataUniversalIdentifier:
        nameField.universalIdentifier,
      fields: [nameField, ...nestedScalarFieldManifests],
    });

    const objectViews = buildDefaultViewsForObject({
      objectUniversalIdentifier,
      labelIdentifierFieldUniversalIdentifier: nameField.universalIdentifier,
      fieldUniversalIdentifiers: nestedScalarFieldManifests.map(
        (fieldManifest) => fieldManifest.universalIdentifier,
      ),
    });

    views.push(...objectViews);

    const fieldsView = objectViews[1];

    pageLayouts.push(
      buildDefaultRecordPageLayout({
        objectUniversalIdentifier,
        labelSingular: object.labelSingular,
        fieldsViewUniversalIdentifier: fieldsView.universalIdentifier,
      }),
    );

    navigationMenuItems.push({
      universalIdentifier: getObjectNavigationMenuItemUniversalIdentifier({
        applicationUniversalIdentifier:
          ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        objectUniversalIdentifier,
      }),
      type: NavigationMenuItemType.OBJECT,
      position: objectIndex,
      targetObjectUniversalIdentifier: objectUniversalIdentifier,
    });
  }

  for (const fieldWithObject of fieldsData) {
    if (arxenaObjectNames.has(fieldWithObject.objectName)) {
      continue;
    }

    const isHostExtensionObject =
      (owner === 'video-interview' &&
        isVideoInterviewHostObjectName(fieldWithObject.objectName)) ||
      (owner === 'shortlist-presentation' &&
        isShortlistPresentationHostObjectName(fieldWithObject.objectName)) ||
      (owner === 'assistant' &&
        isAssistantHostObjectName(fieldWithObject.objectName));

    // Only attach custom fields to known hosts; skip names that already exist
    // on the standard object (e.g. workflowRun.state).
    if (
      !isHostExtensionObject &&
      (!isStandardObjectName(fieldWithObject.objectName) ||
        standardObjectAlreadyHasField({
          objectName: fieldWithObject.objectName,
          fieldName: fieldWithObject.field.name,
        }))
    ) {
      continue;
    }

    topLevelFields.push(
      buildScalarFieldManifest({
        objectName: fieldWithObject.objectName,
        field: fieldWithObject.field,
      }),
    );
  }

  for (const relationWithObjects of relationsData) {
    const { fromObjectName, toObjectName, relationMetadata } =
      relationWithObjects;

    const isFromKnown =
      arxenaObjectNames.has(fromObjectName) ||
      isStandardObjectName(fromObjectName) ||
      (owner === 'video-interview' &&
        isVideoInterviewHostObjectName(fromObjectName)) ||
      (owner === 'shortlist-presentation' &&
        isShortlistPresentationHostObjectName(fromObjectName));
    const isToKnown =
      arxenaObjectNames.has(toObjectName) ||
      isStandardObjectName(toObjectName) ||
      (owner === 'video-interview' &&
        isVideoInterviewHostObjectName(toObjectName)) ||
      (owner === 'shortlist-presentation' &&
        isShortlistPresentationHostObjectName(toObjectName));

    if (!isFromKnown || !isToKnown) {
      continue;
    }

    // Skip relations whose field name would collide with an existing standard field
    if (
      standardObjectAlreadyHasField({
        objectName: fromObjectName,
        fieldName: relationMetadata.fromName,
      }) ||
      standardObjectAlreadyHasField({
        objectName: toObjectName,
        fieldName: relationMetadata.toName,
      })
    ) {
      continue;
    }

    const isManyToOne = relationMetadata.relationType === 'MANY_TO_ONE';
    const fromRelationType = isManyToOne
      ? RelationType.MANY_TO_ONE
      : RelationType.ONE_TO_MANY;
    const toRelationType = isManyToOne
      ? RelationType.ONE_TO_MANY
      : RelationType.MANY_TO_ONE;

    topLevelFields.push(
      buildRelationFieldManifest({
        objectName: fromObjectName,
        fieldName: relationMetadata.fromName,
        label: relationMetadata.fromLabel,
        description: relationMetadata.fromDescription,
        icon: relationMetadata.fromIcon,
        relationType: fromRelationType,
        targetObjectName: toObjectName,
        targetFieldName: relationMetadata.toName,
      }),
      buildRelationFieldManifest({
        objectName: toObjectName,
        fieldName: relationMetadata.toName,
        label: relationMetadata.toLabel,
        description: relationMetadata.toDescription,
        icon: relationMetadata.toIcon || 'IconRelationOneToMany',
        relationType: toRelationType,
        targetObjectName: fromObjectName,
        targetFieldName: relationMetadata.fromName,
      }),
    );
  }

  if (owner === 'arxena-standard') {
    pageLayouts.push(buildGtmCommandDashboardPageLayout());
  }

  const application =
    owner === 'video-interview'
      ? VIDEO_INTERVIEW_APPLICATION
      : owner === 'shortlist-presentation'
        ? SHORTLIST_PRESENTATION_APPLICATION
        : owner === 'assistant'
          ? ASSISTANT_APPLICATION
          : ARXENA_STANDARD_APPLICATION;

  return {
    application: {
      universalIdentifier: application.universalIdentifier,
      displayName: application.name,
      description: application.description ?? '',
      defaultRoleUniversalIdentifier: '00000000-0000-0000-0000-000000000000',
      packageJsonChecksum: null,
      yarnLockChecksum: null,
    },
    objects,
    fields: topLevelFields,
    indexes: [],
    logicFunctions: [],
    frontComponents: [],
    permissionFlags: [],
    roles: [],
    skills: [],
    agents: [],
    publicAssets: [],
    views,
    viewFields: [],
    navigationMenuItems,
    pageLayouts,
    pageLayoutTabs: [],
    commandMenuItems: [],
  };
};
