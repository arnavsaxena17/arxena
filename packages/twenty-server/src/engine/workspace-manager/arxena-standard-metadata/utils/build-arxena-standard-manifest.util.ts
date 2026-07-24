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
import { getFieldsData } from 'src/engine/workspace-manager/arxena-standard-metadata/data/fields-data';
import { getObjectCreationArr } from 'src/engine/workspace-manager/arxena-standard-metadata/data/objects-data';
import { getRelationsData } from 'src/engine/workspace-manager/arxena-standard-metadata/data/relations-data';
import {
  ARXENA_STANDARD_APPLICATION,
  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';
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

const resolveObjectUniversalIdentifier = (nameSingular: string): string => {
  if (isStandardObjectName(nameSingular)) {
    return STANDARD_OBJECTS[nameSingular].universalIdentifier;
  }

  return getObjectUniversalIdentifier({
    applicationUniversalIdentifier:
      ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
    nameSingular,
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
    name: field.name,
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
    name: fieldName,
  });
  const relationTargetFieldMetadataUniversalIdentifier =
    getFieldUniversalIdentifier({
      applicationUniversalIdentifier:
        ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
      objectUniversalIdentifier: targetObjectUniversalIdentifier,
      name: targetFieldName,
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
): Manifest => {
  const objectDefinitions = getObjectCreationArr(isOrgChartEnabled);
  const fieldsData = getFieldsData(EMPTY_OBJECTS_NAME_ID_MAP, isOrgChartEnabled);
  const relationsData = getRelationsData(
    EMPTY_OBJECTS_NAME_ID_MAP,
    isOrgChartEnabled,
  );

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

    // Only attach custom fields to known Twenty Standard hosts; skip names that
    // already exist on the standard object (e.g. workflowRun.state).
    if (
      !isStandardObjectName(fieldWithObject.objectName) ||
      standardObjectAlreadyHasField({
        objectName: fieldWithObject.objectName,
        fieldName: fieldWithObject.field.name,
      })
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
      isStandardObjectName(fromObjectName);
    const isToKnown =
      arxenaObjectNames.has(toObjectName) ||
      isStandardObjectName(toObjectName);

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

  return {
    application: {
      universalIdentifier: ARXENA_STANDARD_APPLICATION.universalIdentifier,
      displayName: ARXENA_STANDARD_APPLICATION.name,
      description: ARXENA_STANDARD_APPLICATION.description ?? '',
      defaultRoleUniversalIdentifier: '00000000-0000-0000-0000-000000000000',
      packageJsonChecksum: null,
      yarnLockChecksum: null,
    },
    objects,
    fields: topLevelFields,
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
