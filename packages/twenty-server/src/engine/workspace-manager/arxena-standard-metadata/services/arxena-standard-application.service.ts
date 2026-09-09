import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { getFieldUniversalIdentifier } from 'twenty-shared/application';
import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import { ApplicationManifestMigrationService } from 'src/engine/core-modules/application/application-manifest/application-manifest-migration.service';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { fromApplicationEntityToFlatApplication } from 'src/engine/core-modules/application/utils/from-application-entity-to-flat-application.util';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from 'src/engine/core-modules/application/application.exception';
import { formatValidationErrors } from 'src/engine/core-modules/tool-provider/utils/format-validation-errors.util';
import { ALL_FLAT_ENTITY_MAPS_PROPERTIES } from 'src/engine/metadata-modules/flat-entity/constant/all-flat-entity-maps-properties.constant';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import {
  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  CANDIDATE_ENRICHMENT_HOST_EXTENSION_FIELDS,
  CANDIDATE_ENRICHMENT_OBJECT_NAME_SINGULAR,
} from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';
import {
  buildArxenaStandardManifest,
  resolveObjectUniversalIdentifier,
} from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-arxena-standard-manifest.util';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';

type ArxenaPendingFieldRename = {
  objectName: string;
  from: string;
  to: string;
  label: string;
};

// candidate and chatMessage kept the plural FK from the job→project rename
// while every other child of project is singular
const ARXENA_PENDING_FIELD_RENAMES: ArxenaPendingFieldRename[] = [
  {
    objectName: 'candidate',
    from: 'projects',
    to: 'project',
    label: 'Project',
  },
  {
    objectName: 'chatMessage',
    from: 'projects',
    to: 'project',
    label: 'Project',
  },
];

@Injectable()
export class ArxenaStandardApplicationService {
  private readonly logger = new Logger(ArxenaStandardApplicationService.name);

  constructor(
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly applicationService: ApplicationService,
    private readonly applicationManifestMigrationService: ApplicationManifestMigrationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  async synchronizeArxenaStandardApplicationOrThrow({
    workspaceId,
    isOrgChartEnabled,
  }: {
    workspaceId: string;
    isOrgChartEnabled?: boolean;
  }): Promise<void> {
    const syncStart = performance.now();

    await this.applicationService.createArxenaStandardApplication({
      workspaceId,
    });

    const arxenaFlatApplication = await this.findArxenaFlatApplicationOrThrow({
      workspaceId,
    });

    await this.applyPendingFieldRenames({
      workspaceId,
      applicationId: arxenaFlatApplication.id,
    });

    await this.healFieldUniversalIdentifiers({
      workspaceId,
      applicationId: arxenaFlatApplication.id,
    });

    const manifest = buildArxenaStandardManifest(isOrgChartEnabled);

    try {
      await this.applicationManifestMigrationService.syncMetadataFromManifest({
        manifest,
        workspaceId,
        ownerFlatApplication: arxenaFlatApplication,
      });
    } catch (error) {
      if (error instanceof WorkspaceMigrationBuilderException) {
        this.logger.error(formatValidationErrors(error));
      }

      throw error;
    }

    this.logger.log(
      `Arxena standard application sync completed in ${(performance.now() - syncStart).toFixed(0)}ms`,
    );
  }

  // Renaming a manifest field is not expressible as a manifest edit alone: the
  // sync matches by identifier, and the identifier is hashed from the name, so
  // a bare rename reads as "delete + create" and drops the column. Each entry
  // below moves the live row onto the new name (and its new identifier) before
  // the diff runs. Entries become no-ops once applied and can then be deleted.
  private async applyPendingFieldRenames({
    workspaceId,
    applicationId,
  }: {
    workspaceId: string;
    applicationId: string;
  }): Promise<void> {
    for (const rename of ARXENA_PENDING_FIELD_RENAMES) {
      const renamedRows: Array<{ id: string }> =
        await this.coreDataSource.query(
          `
          UPDATE core."fieldMetadata" AS field
          SET name = $4,
              label = $5,
              "universalIdentifier" = $6,
              settings = CASE
                WHEN field.settings ? 'joinColumnName'
                  THEN jsonb_set(field.settings, '{joinColumnName}', $7::jsonb)
                ELSE field.settings
              END
          FROM core."objectMetadata" AS object
          WHERE field."objectMetadataId" = object.id
            AND field."workspaceId" = $1
            AND field."applicationId" = $2
            AND object."nameSingular" = $3
            AND field.name = $8
          RETURNING field.id
        `,
          [
            workspaceId,
            applicationId,
            rename.objectName,
            rename.to,
            rename.label,
            getFieldUniversalIdentifier({
              applicationUniversalIdentifier:
                ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
              objectUniversalIdentifier: resolveObjectUniversalIdentifier(
                rename.objectName,
              ),
              name: rename.to,
            }),
            JSON.stringify(`${rename.to}Id`),
            rename.from,
          ],
        );

      if (renamedRows.length === 0) {
        continue;
      }

      await this.renameRelationJoinColumn({ workspaceId, rename });

      this.logger.log(
        `Renamed ${rename.objectName}.${rename.from} → ${rename.to} for workspace ${workspaceId}`,
      );
    }
  }

  private async renameRelationJoinColumn({
    workspaceId,
    rename,
  }: {
    workspaceId: string;
    rename: ArxenaPendingFieldRename;
  }): Promise<void> {
    const schemaName = getWorkspaceSchemaName(workspaceId);
    const tableName = `_${rename.objectName}`;
    const fromColumnName = `${rename.from}Id`;
    const toColumnName = `${rename.to}Id`;

    const existingColumns: Array<{ column_name: string }> =
      await this.coreDataSource.query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = $2
            AND column_name = $3
        `,
        [schemaName, tableName, fromColumnName],
      );

    if (existingColumns.length === 0) {
      return;
    }

    await this.coreDataSource.query(
      `ALTER TABLE "${schemaName}"."${tableName}" RENAME COLUMN "${fromColumnName}" TO "${toColumnName}"`,
    );

    this.logger.log(
      `Renamed column ${schemaName}.${tableName}.${fromColumnName} → ${toColumnName}`,
    );
  }

  // Field universalIdentifiers are hashed from the field name, and the manifest
  // sync matches rows by identifier only. A field renamed by an earlier upgrade
  // therefore still carries the identifier hashed from its old name, which the
  // sync would read as "delete + create" and drop the column. Re-derive the
  // identifier from the live name before diffing so the rename is seen as an
  // update. Idempotent, and a no-op once every workspace has been healed.
  private async healFieldUniversalIdentifiers({
    workspaceId,
    applicationId,
  }: {
    workspaceId: string;
    applicationId: string;
  }): Promise<void> {
    const fieldRows: Array<{
      id: string;
      name: string;
      universalIdentifier: string | null;
      nameSingular: string;
      isOwnedByApplication: boolean;
    }> = await this.coreDataSource.query(
      `
        SELECT field.id,
               field.name,
               field."universalIdentifier",
               object."nameSingular",
               (field."applicationId" = $2) AS "isOwnedByApplication"
        FROM core."fieldMetadata" AS field
        INNER JOIN core."objectMetadata" AS object
          ON field."objectMetadataId" = object.id
        WHERE field."workspaceId" = $1
      `,
      [workspaceId, applicationId],
    );

    // Any identifier already present in the workspace is unavailable, including
    // ones on soft-deleted rows and rows owned by other applications
    const takenUniversalIdentifiers = new Set(
      fieldRows
        .map((fieldRow) => fieldRow.universalIdentifier)
        .filter(isDefined),
    );

    const updates = fieldRows.reduce<Array<{ id: string; next: string }>>(
      (accumulator, fieldRow) => {
        if (!fieldRow.isOwnedByApplication) {
          return accumulator;
        }

        const expectedUniversalIdentifier = getFieldUniversalIdentifier({
          applicationUniversalIdentifier:
            ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
          objectUniversalIdentifier: resolveObjectUniversalIdentifier(
            fieldRow.nameSingular,
          ),
          name: fieldRow.name,
        });

        if (expectedUniversalIdentifier === fieldRow.universalIdentifier) {
          return accumulator;
        }

        if (takenUniversalIdentifiers.has(expectedUniversalIdentifier)) {
          this.logger.warn(
            `Cannot heal ${fieldRow.nameSingular}.${fieldRow.name} for workspace ${workspaceId}: ${expectedUniversalIdentifier} is already in use`,
          );

          return accumulator;
        }

        takenUniversalIdentifiers.add(expectedUniversalIdentifier);
        accumulator.push({
          id: fieldRow.id,
          next: expectedUniversalIdentifier,
        });

        return accumulator;
      },
      [],
    );

    if (updates.length === 0) {
      return;
    }

    for (const update of updates) {
      await this.coreDataSource.query(
        `
          UPDATE core."fieldMetadata"
          SET "universalIdentifier" = $1
          WHERE id = $2
            AND "workspaceId" = $3
        `,
        [update.next, update.id, workspaceId],
      );
    }

    this.logger.log(
      `Healed ${updates.length} field universalIdentifier(s) for workspace ${workspaceId}`,
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatApplicationMaps',
      ...ALL_FLAT_ENTITY_MAPS_PROPERTIES,
    ]);
  }

  async transferCandidateEnrichmentOwnershipToArxenaStandard({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<boolean> {
    const arxenaStandardApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (!isDefined(arxenaStandardApplication)) {
      return false;
    }

    const applicationId = arxenaStandardApplication.id;
    const objectRows: Array<{ id: string }> = await this.coreDataSource.query(
      `
        SELECT id
        FROM core."objectMetadata"
        WHERE "workspaceId" = $1
          AND "nameSingular" = $2
      `,
      [workspaceId, CANDIDATE_ENRICHMENT_OBJECT_NAME_SINGULAR],
    );

    const objectIds = objectRows.map((row) => row.id);

    if (objectIds.length > 0) {
      await this.coreDataSource.query(
        `
          UPDATE core."objectMetadata"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND id = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."fieldMetadata"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "objectMetadataId" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."view"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "objectMetadataId" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."viewField"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "viewId" IN (
              SELECT id FROM core."view"
              WHERE "workspaceId" = $2
                AND "objectMetadataId" = ANY($3::uuid[])
            )
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."pageLayout"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "objectMetadataId" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."pageLayoutTab"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "pageLayoutId" IN (
              SELECT id FROM core."pageLayout"
              WHERE "workspaceId" = $2
                AND "objectMetadataId" = ANY($3::uuid[])
            )
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."pageLayoutWidget"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "pageLayoutTabId" IN (
              SELECT id FROM core."pageLayoutTab"
              WHERE "workspaceId" = $2
                AND "pageLayoutId" IN (
                  SELECT id FROM core."pageLayout"
                  WHERE "workspaceId" = $2
                    AND "objectMetadataId" = ANY($3::uuid[])
                )
            )
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."navigationMenuItem"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "targetObjectMetadataId" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."indexMetadata"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "objectMetadataId" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );

      await this.coreDataSource.query(
        `
          UPDATE core."searchFieldMetadata"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "objectMetadataId" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, objectIds],
      );
    }

    for (const hostField of CANDIDATE_ENRICHMENT_HOST_EXTENSION_FIELDS) {
      await this.coreDataSource.query(
        `
          UPDATE core."fieldMetadata" AS field
          SET "applicationId" = $1
          FROM core."objectMetadata" AS object
          WHERE field."objectMetadataId" = object.id
            AND field."workspaceId" = $2
            AND object."workspaceId" = $2
            AND object."nameSingular" = $3
            AND field.name = $4
        `,
        [applicationId, workspaceId, hostField.objectName, hostField.fieldName],
      );
    }

    if (objectIds.length > 0) {
      await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
        'flatApplicationMaps',
        ...ALL_FLAT_ENTITY_MAPS_PROPERTIES,
      ]);
    }

    return objectIds.length > 0;
  }

  private async findArxenaFlatApplicationOrThrow({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<FlatApplication> {
    const arxenaApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier: ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (!isDefined(arxenaApplication)) {
      throw new ApplicationException(
        `Arxena standard application not found for workspace ${workspaceId}`,
        ApplicationExceptionCode.APPLICATION_NOT_FOUND,
      );
    }

    return fromApplicationEntityToFlatApplication(arxenaApplication);
  }
}
