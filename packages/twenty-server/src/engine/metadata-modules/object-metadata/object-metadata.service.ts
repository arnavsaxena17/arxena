import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { TypeOrmQueryService } from '@ptc-org/nestjs-query-typeorm';
import {
  ViewKey,
  ViewOpenRecordIn,
  ViewType,
  ViewVisibility,
} from 'twenty-shared/types';
import { fromArrayToUniqueKeyRecord, isDefined } from 'twenty-shared/utils';
import { FindManyOptions, FindOneOptions, Repository } from 'typeorm';
import { v4, v5 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { type FlatCommandMenuItem } from 'src/engine/metadata-modules/flat-command-menu-item/types/flat-command-menu-item.type';
import {
  buildNavigationFlatCommandMenuItem,
  NAVIGATION_COMMAND_UUID_NAMESPACE,
} from 'src/engine/metadata-modules/flat-command-menu-item/utils/build-navigation-flat-command-menu-item.util';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { findFlatEntityByUniversalIdentifierOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { findManyFlatEntityByIdInFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/find-many-flat-entity-by-id-in-flat-entity-maps-or-throw.util';
import { FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { FlatNavigationMenuItem } from 'src/engine/metadata-modules/flat-navigation-menu-item/types/flat-navigation-menu-item.type';
import { FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { fromCreateObjectInputToFlatObjectMetadataAndFlatFieldMetadatasToCreate } from 'src/engine/metadata-modules/flat-object-metadata/utils/from-create-object-input-to-flat-object-metadata-and-flat-field-metadatas-to-create.util';
import { fromDeleteObjectInputToFlatFieldMetadatasToDelete } from 'src/engine/metadata-modules/flat-object-metadata/utils/from-delete-object-input-to-flat-field-metadatas-to-delete.util';
import { fromUpdateObjectInputToFlatObjectMetadataAndRelatedFlatEntities } from 'src/engine/metadata-modules/flat-object-metadata/utils/from-update-object-input-to-flat-object-metadata-and-related-flat-entities.util';
import { type FlatPageLayoutTab } from 'src/engine/metadata-modules/flat-page-layout-tab/types/flat-page-layout-tab.type';
import { type FlatPageLayoutWidget } from 'src/engine/metadata-modules/flat-page-layout-widget/types/flat-page-layout-widget.type';
import { type FlatPageLayout } from 'src/engine/metadata-modules/flat-page-layout/types/flat-page-layout.type';
import { NavigationMenuItemType } from 'src/engine/metadata-modules/navigation-menu-item/enums/navigation-menu-item-type.enum';
import { CreateObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/create-object.input';
import { DeleteOneObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/delete-object.input';
import { UpdateOneObjectInput } from 'src/engine/metadata-modules/object-metadata/dtos/update-object.input';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import {
  ObjectMetadataException,
  ObjectMetadataExceptionCode,
} from 'src/engine/metadata-modules/object-metadata/object-metadata.exception';
import { buildReservedSystemFlatFieldMetadatasForCustomObject } from 'src/engine/metadata-modules/object-metadata/utils/build-reserved-system-flat-field-metadatas-for-custom-object.util';
import { computeFlatDefaultRecordPageLayoutToCreate } from 'src/engine/metadata-modules/object-metadata/utils/compute-flat-default-record-page-layout-to-create.util';
import { computeFlatRecordPageFieldsViewToCreate } from 'src/engine/metadata-modules/object-metadata/utils/compute-flat-record-page-fields-view-to-create.util';
import { computeFlatViewFieldsToCreate } from 'src/engine/metadata-modules/object-metadata/utils/compute-flat-view-fields-to-create.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';
import { type UniversalFlatFieldMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-field-metadata.type';
import { type UniversalFlatObjectMetadata } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-object-metadata.type';
import { type UniversalFlatViewField } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-view-field.type';
import { type UniversalFlatView } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-view.type';

@Injectable()
export class ObjectMetadataService extends TypeOrmQueryService<ObjectMetadataEntity> {
  constructor(
    @InjectRepository(ObjectMetadataEntity)
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly applicationService: ApplicationService,
  ) {
    super(objectMetadataRepository);
  }

  async updateOneObject({
    updateObjectInput,
    workspaceId,
    ownerFlatApplication,
  }: {
    workspaceId: string;
    updateObjectInput: UpdateOneObjectInput;
    ownerFlatApplication?: FlatApplication;
  }): Promise<FlatObjectMetadata> {
    const { workspaceCustomFlatApplication, twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const resolvedOwnerFlatApplication =
      ownerFlatApplication ?? workspaceCustomFlatApplication;

    const {
      flatObjectMetadataMaps: existingFlatObjectMetadataMaps,
      flatIndexMaps: existingFlatIndexMaps,
      flatFieldMetadataMaps: existingFlatFieldMetadataMaps,
      flatViewFieldMaps: existingFlatViewFieldMaps,
      flatViewMaps: existingFlatViewMaps,
      flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps,
      flatSearchFieldMetadataMaps: existingFlatSearchFieldMetadataMaps,
    } = await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
      {
        workspaceId,
        flatMapsKeys: [
          'flatObjectMetadataMaps',
          'flatIndexMaps',
          'flatFieldMetadataMaps',
          'flatViewFieldMaps',
          'flatViewMaps',
          'flatCommandMenuItemMaps',
          'flatSearchFieldMetadataMaps',
        ],
      },
    );

    const {
      otherObjectFlatFieldMetadatasToUpdate,
      flatObjectMetadataToUpdate,
      flatIndexMetadatasToUpdate,
      flatViewFieldsToCreate,
      flatViewFieldsToUpdate,
      searchFieldMetadatasToCreate,
    } = fromUpdateObjectInputToFlatObjectMetadataAndRelatedFlatEntities({
      flatFieldMetadataMaps: existingFlatFieldMetadataMaps,
      flatObjectMetadataMaps: existingFlatObjectMetadataMaps,
      updateObjectInput,
      flatIndexMaps: existingFlatIndexMaps,
      flatViewFieldMaps: existingFlatViewFieldMaps,
      flatViewMaps: existingFlatViewMaps,
      flatSearchFieldMetadataMaps: existingFlatSearchFieldMetadataMaps,
    });

    const existingFlatObjectMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityMaps: existingFlatObjectMetadataMaps,
      flatEntityId: updateObjectInput.id,
    });

    const isActiveChangeDefined = isDefined(updateObjectInput.update.isActive);

    const isBeingEnabled =
      isActiveChangeDefined &&
      updateObjectInput.update.isActive === true &&
      isDefined(existingFlatObjectMetadata) &&
      !existingFlatObjectMetadata.isActive;

    const isBeingDisabled =
      isActiveChangeDefined &&
      updateObjectInput.update.isActive === false &&
      isDefined(existingFlatObjectMetadata) &&
      existingFlatObjectMetadata.isActive;

    const { commandMenuItemsToCreate, commandMenuItemsToUpdate } =
      this.computeCommandMenuItemChangesForActiveToggle({
        isBeingEnabled,
        isBeingDisabled,
        existingFlatObjectMetadata,
        flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps,
        workspaceId,
        applicationId: resolvedOwnerFlatApplication.id,
        applicationUniversalIdentifier:
          resolvedOwnerFlatApplication.universalIdentifier,
      });

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            objectMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: [flatObjectMetadataToUpdate],
            },
            index: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: flatIndexMetadatasToUpdate,
            },
            fieldMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: [...otherObjectFlatFieldMetadatasToUpdate],
            },
            viewField: {
              flatEntityToCreate: flatViewFieldsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: flatViewFieldsToUpdate,
            },
            searchFieldMetadata: {
              flatEntityToCreate: searchFieldMetadatasToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            commandMenuItem: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: commandMenuItemsToUpdate,
            },
          },
          workspaceId,
          isSystemBuild: false,
          applicationUniversalIdentifier:
            resolvedOwnerFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new WorkspaceMigrationBuilderException(
        validateAndBuildResult,
        'Multiple validation errors occurred while updating object',
      );
    }

    if (commandMenuItemsToCreate.length > 0) {
      const commandMenuItemMigrationResult =
        await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
          {
            allFlatEntityOperationByMetadataName: {
              commandMenuItem: {
                flatEntityToCreate: commandMenuItemsToCreate,
                flatEntityToDelete: [],
                flatEntityToUpdate: [],
              },
            },
            workspaceId,
            applicationUniversalIdentifier:
              twentyStandardFlatApplication.universalIdentifier,
          },
        );

      if (commandMenuItemMigrationResult.status === 'fail') {
        throw new WorkspaceMigrationBuilderException(
          commandMenuItemMigrationResult,
          'Multiple validation errors occurred while updating command menu items',
        );
      }
    }

    const { flatObjectMetadataMaps: recomputedFlatObjectMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatObjectMetadataMaps'],
        },
      );

    const updatedFlatObjectMetadata = findFlatEntityByUniversalIdentifier({
      universalIdentifier: flatObjectMetadataToUpdate.universalIdentifier,
      flatEntityMaps: recomputedFlatObjectMetadataMaps,
    });

    if (!isDefined(updatedFlatObjectMetadata)) {
      throw new ObjectMetadataException(
        'Updated object metadata not found in recomputed cache',
        ObjectMetadataExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }

    if (isDefined(updateObjectInput.update.labelIdentifierFieldMetadataId)) {
      await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
        'rolesPermissions',
      ]);
    }

    if (isActiveChangeDefined) {
      await this.flatEntityMapsCacheService.invalidateFlatEntityMaps({
        workspaceId,
        flatMapsKeys: ['flatNavigationMenuItemMaps', 'flatCommandMenuItemMaps'],
      });
    }

    return updatedFlatObjectMetadata;
  }

  async deleteOneObject({
    deleteObjectInput,
    workspaceId,
    isSystemBuild = false,
    ownerFlatApplication,
  }: {
    deleteObjectInput: DeleteOneObjectInput;
    workspaceId: string;
    isSystemBuild?: boolean;
    ownerFlatApplication?: FlatApplication;
  }): Promise<FlatObjectMetadata> {
    const deletedObjectMetadataDtos = await this.deleteManyObjectMetadatas({
      deleteObjectInputs: [deleteObjectInput],
      workspaceId,
      isSystemBuild,
      ownerFlatApplication,
    });

    if (deletedObjectMetadataDtos.length !== 1) {
      throw new ObjectMetadataException(
        'Could not retrieve deleted object metadata dto',
        ObjectMetadataExceptionCode.INTERNAL_SERVER_ERROR,
      );
    }

    const [deletedObjectMetadataDto] = deletedObjectMetadataDtos;

    return deletedObjectMetadataDto;
  }

  private async deleteManyObjectMetadatas({
    workspaceId,
    deleteObjectInputs,
    isSystemBuild = false,
    ownerFlatApplication,
  }: {
    deleteObjectInputs: DeleteOneObjectInput[];
    workspaceId: string;
    isSystemBuild?: boolean;
    ownerFlatApplication?: FlatApplication;
  }): Promise<FlatObjectMetadata[]> {
    if (deleteObjectInputs.length === 0) {
      return [];
    }

    const resolvedOwnerFlatApplication =
      ownerFlatApplication ??
      (
        await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
          { workspaceId },
        )
      ).workspaceCustomFlatApplication;

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps,
      flatCommandMenuItemMaps,
    } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: [
            'flatObjectMetadataMaps',
            'flatIndexMaps',
            'flatFieldMetadataMaps',
            'flatCommandMenuItemMaps',
          ],
        },
      );

    const initialAccumulator: {
      flatFieldMetadatasToDeleteByUniversalIdentifier: Record<
        string,
        UniversalFlatFieldMetadata
      >;
      flatObjectMetadatasToDeleteByUniversalIdentifier: Record<
        string,
        UniversalFlatObjectMetadata
      >;
      flatIndexToDeleteByUniversalIdentifier: Record<string, FlatIndexMetadata>;
    } = {
      flatFieldMetadatasToDeleteByUniversalIdentifier: {},
      flatIndexToDeleteByUniversalIdentifier: {},
      flatObjectMetadatasToDeleteByUniversalIdentifier: {},
    };

    const {
      flatFieldMetadatasToDeleteByUniversalIdentifier,
      flatIndexToDeleteByUniversalIdentifier,
      flatObjectMetadatasToDeleteByUniversalIdentifier,
    } = deleteObjectInputs.reduce((accumulator, deleteObjectInput) => {
      const {
        flatFieldMetadatasToDelete,
        flatObjectMetadataToDelete,
        flatIndexToDelete,
      } = fromDeleteObjectInputToFlatFieldMetadatasToDelete({
        flatObjectMetadataMaps,
        flatIndexMaps,
        flatFieldMetadataMaps,
        deleteObjectInput,
      });

      return {
        flatFieldMetadatasToDeleteByUniversalIdentifier: {
          ...accumulator.flatFieldMetadatasToDeleteByUniversalIdentifier,
          ...fromArrayToUniqueKeyRecord({
            array: flatFieldMetadatasToDelete,
            uniqueKey: 'universalIdentifier',
          }),
        },
        flatIndexToDeleteByUniversalIdentifier: {
          ...accumulator.flatIndexToDeleteByUniversalIdentifier,
          ...fromArrayToUniqueKeyRecord({
            array: flatIndexToDelete,
            uniqueKey: 'universalIdentifier',
          }),
        },
        flatObjectMetadatasToDeleteByUniversalIdentifier: {
          ...accumulator.flatObjectMetadatasToDeleteByUniversalIdentifier,
          [flatObjectMetadataToDelete.universalIdentifier]:
            flatObjectMetadataToDelete,
        },
      };
    }, initialAccumulator);

    const {
      flatFieldMetadatasToDelete,
      flatObjectMetadatasToDelete,
      flatIndexToDelete,
    } = {
      flatFieldMetadatasToDelete: Object.values(
        flatFieldMetadatasToDeleteByUniversalIdentifier,
      ),
      flatObjectMetadatasToDelete: Object.values(
        flatObjectMetadatasToDeleteByUniversalIdentifier,
      ),
      flatIndexToDelete: Object.values(flatIndexToDeleteByUniversalIdentifier),
    };

    const deletedFlatObjectMetadatas = flatObjectMetadatasToDelete.map(
      (flatObjectMetadataToDelete) =>
        findFlatEntityByUniversalIdentifierOrThrow({
          universalIdentifier: flatObjectMetadataToDelete.universalIdentifier,
          flatEntityMaps: flatObjectMetadataMaps,
        }),
    );

    const flatCommandMenuItemsToDelete = flatObjectMetadatasToDelete
      .map((flatObjectMetadataToDelete) =>
        this.findNavigationCommandMenuItemForObject({
          objectUniversalIdentifier:
            flatObjectMetadataToDelete.universalIdentifier,
          flatCommandMenuItemMaps,
        }),
      )
      .filter(isDefined);

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            objectMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: flatObjectMetadatasToDelete,
              flatEntityToUpdate: [],
            },
            index: {
              flatEntityToCreate: [],
              flatEntityToDelete: flatIndexToDelete,
              flatEntityToUpdate: [],
            },
            fieldMetadata: {
              flatEntityToCreate: [],
              flatEntityToDelete: flatFieldMetadatasToDelete,
              flatEntityToUpdate: [],
            },
            commandMenuItem: {
              flatEntityToCreate: [],
              flatEntityToDelete: flatCommandMenuItemsToDelete,
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          isSystemBuild,
          applicationUniversalIdentifier:
            resolvedOwnerFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new WorkspaceMigrationBuilderException(
        validateAndBuildResult,
        `Multiple validation errors occurred while deleting object${deleteObjectInputs.length > 1 ? 's' : ''}`,
      );
    }

    return deletedFlatObjectMetadatas;
  }

  async createOneObject({
    createObjectInput,
    workspaceId,
    ownerFlatApplication,
  }: {
    createObjectInput: CreateObjectInput;
    workspaceId: string;
    ownerFlatApplication?: FlatApplication;
  }): Promise<FlatObjectMetadata> {
    const [createdFlatObjectMetadata] = await this.createManyObjects({
      createObjectInputs: [createObjectInput],
      workspaceId,
      ownerFlatApplication,
    });

    if (!isDefined(createdFlatObjectMetadata)) {
      throw new ObjectMetadataException(
        'Created object metadata not found in recomputed cache',
        ObjectMetadataExceptionCode.OBJECT_METADATA_NOT_FOUND,
      );
    }

    return createdFlatObjectMetadata;
  }

  async createManyObjects({
    createObjectInputs,
    workspaceId,
    ownerFlatApplication,
  }: {
    createObjectInputs: CreateObjectInput[];
    workspaceId: string;
    ownerFlatApplication?: FlatApplication;
  }): Promise<FlatObjectMetadata[]> {
    if (createObjectInputs.length === 0) {
      return [];
    }

    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        {
          workspaceId,
        },
      );

    const resolvedOwnerFlatApplication =
      ownerFlatApplication ?? workspaceCustomFlatApplication;

    const { flatCommandMenuItemMaps, flatNavigationMenuItemMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: [
            'flatCommandMenuItemMaps',
            'flatNavigationMenuItemMaps',
          ],
        },
      );

    const workspaceLevelNavigationItems = Object.values(
      flatNavigationMenuItemMaps.byUniversalIdentifier,
    ).filter(
      (item): item is FlatNavigationMenuItem =>
        isDefined(item) && !isDefined(item.userWorkspaceId),
    );
    let nextNavigationMenuItemPosition =
      workspaceLevelNavigationItems.length > 0
        ? Math.max(
            ...workspaceLevelNavigationItems.map((item) => item.position),
          ) + 1
        : 0;

    const existingCommandMenuItems = Object.values(
      flatCommandMenuItemMaps.byUniversalIdentifier,
    ).filter(isDefined);
    let nextCommandMenuItemPosition =
      existingCommandMenuItems.length > 0
        ? Math.max(...existingCommandMenuItems.map((item) => item.position)) +
          1
        : 0;

    const flatObjectMetadatasToCreate: (UniversalFlatObjectMetadata & {
      id: string;
    })[] = [];
    const flatFieldMetadatasToCreate: UniversalFlatFieldMetadata[] = [];
    const flatViewsToCreate: (UniversalFlatView & { id: string })[] = [];
    const flatViewFieldsToCreate: UniversalFlatViewField[] = [];
    const flatCommandMenuItemsToCreate: FlatCommandMenuItem[] = [];
    const flatNavigationMenuItemsToCreate: FlatNavigationMenuItem[] = [];
    const flatPageLayoutsToCreate: FlatPageLayout[] = [];
    const flatPageLayoutTabsToCreate: FlatPageLayoutTab[] = [];
    const flatPageLayoutWidgetsToCreate: FlatPageLayoutWidget[] = [];

    for (const createObjectInput of createObjectInputs) {
      const { flatObjectMetadataToCreate, flatFieldMetadataToCreateOnObject } =
        fromCreateObjectInputToFlatObjectMetadataAndFlatFieldMetadatasToCreate({
          createObjectInput,
          flatApplication: resolvedOwnerFlatApplication,
        });

      // Default view fields reference the caller-provided fields (reused as-is from
      // the transpiler output) plus the engine-owned reserved system fields, whose
      // deterministic identifiers we re-derive here (searchVector is never shown).
      // TODO: remove once default view fields move to the metadata side effect engine.
      const defaultFlatFieldMetadatasForViewFields: UniversalFlatFieldMetadata[] =
        [
          ...flatFieldMetadataToCreateOnObject,
          ...Object.values(
            buildReservedSystemFlatFieldMetadatasForCustomObject({
              flatObjectMetadata: {
                applicationUniversalIdentifier:
                  resolvedOwnerFlatApplication.universalIdentifier,
                universalIdentifier:
                  flatObjectMetadataToCreate.universalIdentifier,
              },
            }),
          ),
        ];

      const flatDefaultViewToCreate = this.computeFlatViewToCreate({
        objectMetadata: flatObjectMetadataToCreate,
        flatApplication: resolvedOwnerFlatApplication,
      });

      const flatDefaultViewFieldsToCreate = computeFlatViewFieldsToCreate({
        flatApplication: resolvedOwnerFlatApplication,
        objectFlatFieldMetadatas: defaultFlatFieldMetadatasForViewFields,
        labelIdentifierFieldMetadataUniversalIdentifier:
          flatObjectMetadataToCreate.labelIdentifierFieldMetadataUniversalIdentifier,
        viewUniversalIdentifier: flatDefaultViewToCreate.universalIdentifier,
      });

      const flatNavigationMenuItemToCreate =
        this.buildFlatNavigationMenuItemToCreate({
          objectMetadata: flatObjectMetadataToCreate,
          workspaceId,
          workspaceCustomApplicationId: workspaceCustomFlatApplication.id,
          workspaceCustomApplicationUniversalIdentifier:
            workspaceCustomFlatApplication.universalIdentifier,
          position: nextNavigationMenuItemPosition,
        });

      nextNavigationMenuItemPosition += 1;

      const flatCommandMenuItemToCreate =
        this.buildFlatNavigationCommandMenuItem({
          objectMetadata: flatObjectMetadataToCreate,
          workspaceId,
          applicationId: resolvedOwnerFlatApplication.id,
          applicationUniversalIdentifier:
            resolvedOwnerFlatApplication.universalIdentifier,
          flatCommandMenuItemMaps,
          position: nextCommandMenuItemPosition,
        });

      nextCommandMenuItemPosition += 1;

      const flatRecordPageFieldsViewToCreate =
        this.computeFlatRecordPageFieldsViewToCreate({
          objectMetadata: flatObjectMetadataToCreate,
          flatApplication: resolvedOwnerFlatApplication,
        });

      const flatRecordPageFieldsViewFieldsToCreate =
        computeFlatViewFieldsToCreate({
          flatApplication: resolvedOwnerFlatApplication,
          objectFlatFieldMetadatas: defaultFlatFieldMetadatasForViewFields,
          labelIdentifierFieldMetadataUniversalIdentifier:
            flatObjectMetadataToCreate.labelIdentifierFieldMetadataUniversalIdentifier,
          viewUniversalIdentifier:
            flatRecordPageFieldsViewToCreate.universalIdentifier,
          excludeLabelIdentifier: true,
        });

      const flatDefaultRecordPageLayoutsToCreate =
        this.computeFlatDefaultRecordPageLayoutToCreate({
          objectMetadata: flatObjectMetadataToCreate,
          flatApplication: resolvedOwnerFlatApplication,
          recordPageFieldsView: flatRecordPageFieldsViewToCreate,
          workspaceId,
        });

      flatObjectMetadatasToCreate.push(flatObjectMetadataToCreate);
      flatFieldMetadatasToCreate.push(...flatFieldMetadataToCreateOnObject);
      flatViewsToCreate.push(
        flatDefaultViewToCreate,
        flatRecordPageFieldsViewToCreate,
      );
      flatViewFieldsToCreate.push(
        ...flatDefaultViewFieldsToCreate,
        ...flatRecordPageFieldsViewFieldsToCreate,
      );
      flatCommandMenuItemsToCreate.push(flatCommandMenuItemToCreate);
      flatNavigationMenuItemsToCreate.push(flatNavigationMenuItemToCreate);
      flatPageLayoutsToCreate.push(
        ...flatDefaultRecordPageLayoutsToCreate.pageLayouts,
      );
      flatPageLayoutTabsToCreate.push(
        ...flatDefaultRecordPageLayoutsToCreate.pageLayoutTabs,
      );
      flatPageLayoutWidgetsToCreate.push(
        ...flatDefaultRecordPageLayoutsToCreate.pageLayoutWidgets,
      );
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            objectMetadata: {
              flatEntityToCreate: flatObjectMetadatasToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            fieldMetadata: {
              flatEntityToCreate: flatFieldMetadatasToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            index: {
              flatEntityToCreate: [],
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            view: {
              flatEntityToCreate: flatViewsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            viewField: {
              flatEntityToCreate: flatViewFieldsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            commandMenuItem: {
              flatEntityToCreate: flatCommandMenuItemsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            pageLayout: {
              flatEntityToCreate: flatPageLayoutsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            pageLayoutTab: {
              flatEntityToCreate: flatPageLayoutTabsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            pageLayoutWidget: {
              flatEntityToCreate: flatPageLayoutWidgetsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
            navigationMenuItem: {
              flatEntityToCreate: flatNavigationMenuItemsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
          workspaceId,
          isSystemBuild: false,
          applicationUniversalIdentifier:
            resolvedOwnerFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new WorkspaceMigrationBuilderException(
        validateAndBuildResult,
        `Multiple validation errors occurred while creating object${createObjectInputs.length > 1 ? 's' : ''}`,
      );
    }

    const { flatObjectMetadataMaps: recomputedFlatObjectMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatObjectMetadataMaps'],
        },
      );

    return flatObjectMetadatasToCreate.map((flatObjectMetadataToCreate) => {
      const createdFlatObjectMetadata = findFlatEntityByIdInFlatEntityMaps({
        flatEntityId: flatObjectMetadataToCreate.id,
        flatEntityMaps: recomputedFlatObjectMetadataMaps,
      });

      if (!isDefined(createdFlatObjectMetadata)) {
        throw new ObjectMetadataException(
          'Created object metadata not found in recomputed cache',
          ObjectMetadataExceptionCode.OBJECT_METADATA_NOT_FOUND,
        );
      }

      return createdFlatObjectMetadata;
    });
  }

  private computeFlatViewToCreate({
    objectMetadata,
    flatApplication,
  }: {
    flatApplication: FlatApplication;
    objectMetadata: UniversalFlatObjectMetadata & { id: string };
  }): UniversalFlatView & { id: string } {
    const createdAt = new Date().toISOString();

    return {
      id: v4(),
      objectMetadataUniversalIdentifier: objectMetadata.universalIdentifier,
      name: `All {objectLabelPlural}`,
      key: ViewKey.INDEX,
      icon: 'IconList',
      type: ViewType.TABLE,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      isCustom: true,
      anyFieldFilterValue: null,
      calendarFieldMetadataUniversalIdentifier: null,
      calendarEndFieldMetadataUniversalIdentifier: null,
      calendarLayout: null,
      isCompact: false,
      shouldHideEmptyGroups: false,
      kanbanColumnWidth: null,
      kanbanAggregateOperation: null,
      kanbanAggregateOperationFieldMetadataUniversalIdentifier: null,
      mainGroupByFieldMetadataUniversalIdentifier: null,
      openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
      position: 0,
      universalIdentifier: v4(),
      visibility: ViewVisibility.WORKSPACE,
      createdByUserWorkspaceId: null,
      isActive: true,
      isSystemSideEffect: true,
      universalOverrides: null,
      viewFieldUniversalIdentifiers: [],
      viewFieldGroupUniversalIdentifiers: [],
      viewFilterUniversalIdentifiers: [],
      viewGroupUniversalIdentifiers: [],
      viewFilterGroupUniversalIdentifiers: [],
      viewSortUniversalIdentifiers: [],
      applicationUniversalIdentifier: flatApplication.universalIdentifier,
    };
  }

  private computeFlatRecordPageFieldsViewToCreate({
    objectMetadata,
    flatApplication,
  }: {
    flatApplication: FlatApplication;
    objectMetadata: UniversalFlatObjectMetadata & { id: string };
  }): UniversalFlatView & { id: string } {
    return computeFlatRecordPageFieldsViewToCreate({
      objectMetadata,
      flatApplication,
    });
  }

  private computeFlatDefaultRecordPageLayoutToCreate({
    objectMetadata,
    flatApplication,
    recordPageFieldsView,
    workspaceId,
  }: {
    flatApplication: FlatApplication;
    objectMetadata: UniversalFlatObjectMetadata & { id: string };
    recordPageFieldsView: UniversalFlatView & { id: string };
    workspaceId: string;
  }): {
    pageLayouts: FlatPageLayout[];
    pageLayoutTabs: FlatPageLayoutTab[];
    pageLayoutWidgets: FlatPageLayoutWidget[];
  } {
    return computeFlatDefaultRecordPageLayoutToCreate({
      objectMetadata,
      flatApplication,
      recordPageFieldsView,
      workspaceId,
    });
  }

  private buildFlatNavigationMenuItemToCreate({
    objectMetadata,
    workspaceId,
    workspaceCustomApplicationId,
    workspaceCustomApplicationUniversalIdentifier,
    position,
  }: {
    objectMetadata: { id: string; universalIdentifier: string };
    workspaceId: string;
    workspaceCustomApplicationId: string;
    workspaceCustomApplicationUniversalIdentifier: string;
    position: number;
  }): FlatNavigationMenuItem {
    const newId = v4();
    const now = new Date().toISOString();

    return {
      id: newId,
      type: NavigationMenuItemType.OBJECT,
      universalIdentifier: newId,
      userWorkspaceId: null,
      targetRecordId: null,
      targetObjectMetadataId: objectMetadata.id,
      targetObjectMetadataUniversalIdentifier:
        objectMetadata.universalIdentifier,
      viewId: null,
      viewUniversalIdentifier: null,
      folderId: null,
      folderUniversalIdentifier: null,
      pageLayoutId: null,
      pageLayoutUniversalIdentifier: null,
      name: null,
      link: null,
      icon: null,
      color: null,
      position,
      workspaceId,
      applicationId: workspaceCustomApplicationId,
      applicationUniversalIdentifier:
        workspaceCustomApplicationUniversalIdentifier,
      createdAt: now,
      updatedAt: now,
    };
  }

  private buildFlatNavigationCommandMenuItem({
    objectMetadata,
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
    flatCommandMenuItemMaps,
    position,
  }: {
    objectMetadata: {
      id: string;
      universalIdentifier: string;
      labelPlural: string;
      icon: string | null;
      nameSingular: string;
      shortcut: string | null;
    };
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
    flatCommandMenuItemMaps: {
      byUniversalIdentifier: Record<string, FlatCommandMenuItem | undefined>;
    };
    position?: number;
  }): FlatCommandMenuItem {
    const existingItems = Object.values(
      flatCommandMenuItemMaps.byUniversalIdentifier,
    ).filter(isDefined);

    const nextPosition =
      position ??
      (existingItems.length > 0
        ? Math.max(...existingItems.map((item) => item.position)) + 1
        : 0);

    return buildNavigationFlatCommandMenuItem({
      objectMetadata,
      commandMenuItemId: v4(),
      applicationId,
      applicationUniversalIdentifier,
      workspaceId,
      position: nextPosition,
      now: new Date().toISOString(),
    });
  }

  private findNavigationCommandMenuItemForObject({
    objectUniversalIdentifier,
    flatCommandMenuItemMaps,
  }: {
    objectUniversalIdentifier: string;
    flatCommandMenuItemMaps: {
      byUniversalIdentifier: Record<string, FlatCommandMenuItem | undefined>;
    };
  }): FlatCommandMenuItem | undefined {
    const commandMenuItemUniversalIdentifier = v5(
      objectUniversalIdentifier,
      NAVIGATION_COMMAND_UUID_NAMESPACE,
    );

    return findFlatEntityByUniversalIdentifier({
      flatEntityMaps: flatCommandMenuItemMaps,
      universalIdentifier: commandMenuItemUniversalIdentifier,
    });
  }

  private computeCommandMenuItemChangesForActiveToggle({
    isBeingEnabled,
    isBeingDisabled,
    existingFlatObjectMetadata,
    flatCommandMenuItemMaps,
    workspaceId,
    applicationId,
    applicationUniversalIdentifier,
  }: {
    isBeingEnabled: boolean;
    isBeingDisabled: boolean;
    existingFlatObjectMetadata: FlatObjectMetadata | undefined;
    flatCommandMenuItemMaps: {
      byUniversalIdentifier: Record<string, FlatCommandMenuItem | undefined>;
    };
    workspaceId: string;
    applicationId: string;
    applicationUniversalIdentifier: string;
  }): {
    commandMenuItemsToCreate: FlatCommandMenuItem[];
    commandMenuItemsToUpdate: FlatCommandMenuItem[];
  } {
    if (!isDefined(existingFlatObjectMetadata)) {
      return { commandMenuItemsToCreate: [], commandMenuItemsToUpdate: [] };
    }

    const now = new Date().toISOString();

    if (isBeingEnabled) {
      const existingCommandMenuItem =
        this.findNavigationCommandMenuItemForObject({
          objectUniversalIdentifier:
            existingFlatObjectMetadata.universalIdentifier,
          flatCommandMenuItemMaps,
        });

      if (!isDefined(existingCommandMenuItem)) {
        return {
          commandMenuItemsToCreate: [
            this.buildFlatNavigationCommandMenuItem({
              objectMetadata: existingFlatObjectMetadata,
              workspaceId,
              applicationId,
              applicationUniversalIdentifier,
              flatCommandMenuItemMaps,
            }),
          ],
          commandMenuItemsToUpdate: [],
        };
      }

      if (!existingCommandMenuItem.isActive) {
        return {
          commandMenuItemsToCreate: [],
          commandMenuItemsToUpdate: [
            { ...existingCommandMenuItem, isActive: true, updatedAt: now },
          ],
        };
      }
    }

    if (isBeingDisabled) {
      const commandMenuItemToDeactivate =
        this.findNavigationCommandMenuItemForObject({
          objectUniversalIdentifier:
            existingFlatObjectMetadata.universalIdentifier,
          flatCommandMenuItemMaps,
        });

      if (
        isDefined(commandMenuItemToDeactivate) &&
        commandMenuItemToDeactivate.isActive
      ) {
        return {
          commandMenuItemsToCreate: [],
          commandMenuItemsToUpdate: [
            { ...commandMenuItemToDeactivate, isActive: false, updatedAt: now },
          ],
        };
      }
    }

    return { commandMenuItemsToCreate: [], commandMenuItemsToUpdate: [] };
  }

  public async findOneWithinWorkspace(
    workspaceId: string,
    options: FindOneOptions<ObjectMetadataEntity>,
  ): Promise<ObjectMetadataEntity | null> {
    return this.objectMetadataRepository.findOne({
      relations: [
        'fields',
        'indexMetadatas',
        'indexMetadatas.indexFieldMetadatas',
      ],
      ...options,
      where: {
        ...options.where,
        workspaceId,
      },
    });
  }

  public async findManyWithinWorkspace(
    workspaceId: string,
    options?: FindManyOptions<ObjectMetadataEntity>,
  ): Promise<FlatObjectMetadata[]> {
    const whereWithWorkspaceId = Array.isArray(options?.where)
      ? options.where.map((whereCondition) => ({
          ...whereCondition,
          workspaceId,
        }))
      : {
          ...options?.where,
          workspaceId,
        };

    const objectMetadataEntities = await this.objectMetadataRepository.find({
      ...options,
      where: whereWithWorkspaceId,
      order: {
        ...options?.order,
      },
      select: { id: true },
    });

    const objectMetadataIds = objectMetadataEntities.map(
      (objectMetadata) => objectMetadata.id,
    );

    const { flatObjectMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId,
          flatMapsKeys: ['flatObjectMetadataMaps'],
        },
      );

    const filteredOutAndSortedFlatObjectMetadataMaps =
      findManyFlatEntityByIdInFlatEntityMapsOrThrow({
        flatEntityMaps: flatObjectMetadataMaps,
        flatEntityIds: objectMetadataIds,
      });

    return filteredOutAndSortedFlatObjectMetadataMaps;
  }
}
