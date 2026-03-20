import { Injectable } from '@nestjs/common';

import { FieldMetadataType } from 'twenty-shared';

import { WorkspaceMigrationBuilderAction } from 'src/engine/workspace-manager/workspace-migration-builder/interfaces/workspace-migration-builder-action.interface';

import { computeColumnName } from 'src/engine/metadata-modules/field-metadata/utils/compute-column-name.util';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { RelationMetadataEntity } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import { generateMigrationName } from 'src/engine/metadata-modules/workspace-migration/utils/generate-migration-name.util';
import {
    WorkspaceMigrationColumnActionType,
    WorkspaceMigrationEntity,
    WorkspaceMigrationTableAction,
    WorkspaceMigrationTableActionType,
} from 'src/engine/metadata-modules/workspace-migration/workspace-migration.entity';
import { WorkspaceMigrationFactory } from 'src/engine/metadata-modules/workspace-migration/workspace-migration.factory';
import { computeObjectTargetTable } from 'src/engine/utils/compute-object-target-table.util';

export type RelationMetadataIndexByObjectRole = {
  byFromObjectMetadataId: Record<string, RelationMetadataEntity[]>;
  byToObjectMetadataId: Record<string, RelationMetadataEntity[]>;
};

export interface ObjectMetadataUpdate {
  current: ObjectMetadataEntity;
  altered: ObjectMetadataEntity;
}

@Injectable()
export class WorkspaceMigrationObjectFactory {
  constructor(
    private readonly workspaceMigrationFactory: WorkspaceMigrationFactory,
  ) {}

  async create(
    objectMetadataCollection: ObjectMetadataEntity[],
    action: WorkspaceMigrationBuilderAction.CREATE,
  ): Promise<Partial<WorkspaceMigrationEntity>[]>;

  async create(
    objectMetadataUpdateCollection: ObjectMetadataUpdate[],
    action: WorkspaceMigrationBuilderAction.UPDATE,
  ): Promise<Partial<WorkspaceMigrationEntity>[]>;

  async create(
    objectMetadataCollection: ObjectMetadataEntity[],
    action: WorkspaceMigrationBuilderAction.DELETE,
    relationMetadataIndex: RelationMetadataIndexByObjectRole,
  ): Promise<Partial<WorkspaceMigrationEntity>[]>;

  async create(
    objectMetadataCollectionOrObjectMetadataUpdateCollection:
      | ObjectMetadataEntity[]
      | ObjectMetadataUpdate[],
    action: WorkspaceMigrationBuilderAction,
    relationMetadataIndex?: RelationMetadataIndexByObjectRole,
  ): Promise<Partial<WorkspaceMigrationEntity>[]> {
    switch (action) {
      case WorkspaceMigrationBuilderAction.CREATE:
        return this.createObjectMigration(
          objectMetadataCollectionOrObjectMetadataUpdateCollection as ObjectMetadataEntity[],
        );
      case WorkspaceMigrationBuilderAction.UPDATE:
        return this.updateObjectMigration(
          objectMetadataCollectionOrObjectMetadataUpdateCollection as ObjectMetadataUpdate[],
        );
      case WorkspaceMigrationBuilderAction.DELETE:
        return this.deleteObjectMigration(
          objectMetadataCollectionOrObjectMetadataUpdateCollection as ObjectMetadataEntity[],
          relationMetadataIndex as RelationMetadataIndexByObjectRole,
        );
      default:
        return [];
    }
  }

  private async createObjectMigration(
    objectMetadataCollection: ObjectMetadataEntity[],
  ): Promise<Partial<WorkspaceMigrationEntity>[]> {
    const workspaceMigrations: Partial<WorkspaceMigrationEntity>[] = [];

    for (const objectMetadata of objectMetadataCollection) {
      const migrations: WorkspaceMigrationTableAction[] = [
        {
          name: computeObjectTargetTable(objectMetadata),
          action: WorkspaceMigrationTableActionType.CREATE,
        },
      ];

      for (const field of objectMetadata.fields) {
        if (field.type === FieldMetadataType.RELATION) {
          continue;
        }

        migrations.push({
          name: computeObjectTargetTable(objectMetadata),
          action: WorkspaceMigrationTableActionType.ALTER,
          columns: this.workspaceMigrationFactory.createColumnActions(
            WorkspaceMigrationColumnActionType.CREATE,
            field,
          ),
        });
      }

      workspaceMigrations.push({
        workspaceId: objectMetadata.workspaceId,
        name: generateMigrationName(`create-${objectMetadata.nameSingular}`),
        isCustom: false,
        migrations,
      });
    }

    return workspaceMigrations;
  }

  private async updateObjectMigration(
    objectMetadataUpdateCollection: ObjectMetadataUpdate[],
  ): Promise<Partial<WorkspaceMigrationEntity>[]> {
    const workspaceMigrations: Partial<WorkspaceMigrationEntity>[] = [];

    for (const objectMetadataUpdate of objectMetadataUpdateCollection) {
      const oldTableName = computeObjectTargetTable(
        objectMetadataUpdate.current,
      );
      const newTableName = computeObjectTargetTable(
        objectMetadataUpdate.altered,
      );

      if (oldTableName !== newTableName) {
        workspaceMigrations.push({
          workspaceId: objectMetadataUpdate.current.workspaceId,
          name: generateMigrationName(
            `rename-${objectMetadataUpdate.current.nameSingular}`,
          ),
          isCustom: false,
          migrations: [
            {
              name: oldTableName,
              newName: newTableName,
              action: WorkspaceMigrationTableActionType.ALTER,
            },
          ],
        });
      }
    }

    return workspaceMigrations;
  }

  private async deleteObjectMigration(
    objectMetadataCollection: ObjectMetadataEntity[],
    relationMetadataIndex: RelationMetadataIndexByObjectRole,
  ): Promise<Partial<WorkspaceMigrationEntity>[]> {
    const workspaceMigrations: Partial<WorkspaceMigrationEntity>[] = [];

    for (const objectMetadata of objectMetadataCollection) {
      const relationsWhereDeletedObjectIsFrom =
        relationMetadataIndex.byFromObjectMetadataId[objectMetadata.id] ?? [];
      const relationsWhereDeletedObjectIsTo =
        relationMetadataIndex.byToObjectMetadataId[objectMetadata.id] ?? [];

      const dropIncomingOrOutgoingForeignKeyMigrations: WorkspaceMigrationTableAction[] =
        [
          ...relationsWhereDeletedObjectIsFrom.map(
            (relationMetadata) =>
              ({
                name: computeObjectTargetTable(
                  relationMetadata.toObjectMetadata,
                ),
                action: WorkspaceMigrationTableActionType.ALTER,
                columns: [
                  {
                    action: WorkspaceMigrationColumnActionType.DROP_FOREIGN_KEY,
                    columnName: computeColumnName(
                      relationMetadata.toFieldMetadata.name,
                      { isForeignKey: true },
                    ),
                  },
                ],
              }) satisfies WorkspaceMigrationTableAction,
          ),
          ...relationsWhereDeletedObjectIsTo.map(
            (relationMetadata) =>
              ({
                name: computeObjectTargetTable(
                  relationMetadata.fromObjectMetadata,
                ),
                action: WorkspaceMigrationTableActionType.ALTER,
                columns: [
                  {
                    action: WorkspaceMigrationColumnActionType.DROP_FOREIGN_KEY,
                    columnName: computeColumnName(
                      relationMetadata.fromFieldMetadata.name,
                      { isForeignKey: true },
                    ),
                  },
                ],
              }) satisfies WorkspaceMigrationTableAction,
          ),
        ];

      workspaceMigrations.push({
        workspaceId: objectMetadata.workspaceId,
        name: generateMigrationName(`delete-${objectMetadata.nameSingular}`),
        isCustom: false,
        migrations: [
          ...dropIncomingOrOutgoingForeignKeyMigrations,
          {
            name: computeObjectTargetTable(objectMetadata),
            action: WorkspaceMigrationTableActionType.DROP,
            columns: [],
          } satisfies WorkspaceMigrationTableAction,
        ],
      });
    }

    return workspaceMigrations;
  }
}
