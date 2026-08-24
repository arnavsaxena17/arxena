import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared/utils';
import { type DataSource } from 'typeorm';

import { ApplicationManifestMigrationService } from 'src/engine/core-modules/application/application-manifest/application-manifest-migration.service';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from 'src/engine/core-modules/application/application.exception';
import { fromApplicationEntityToFlatApplication } from 'src/engine/core-modules/application/utils/from-application-entity-to-flat-application.util';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { ALL_FLAT_ENTITY_MAPS_PROPERTIES } from 'src/engine/metadata-modules/flat-entity/constant/all-flat-entity-maps-properties.constant';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { formatValidationErrors } from 'src/engine/core-modules/tool-provider/utils/format-validation-errors.util';
import { buildAssistantManifest } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-arxena-standard-manifest.util';
import {
  ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSISTANT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS,
  ASSISTANT_HOST_EXTENSION_FIELDS,
  ASSISTANT_OBJECT_NAME_SINGULARS,
} from 'src/engine/workspace-manager/assistant-application/constants/assistant-application.constant';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';

@Injectable()
export class AssistantApplicationService {
  private readonly logger = new Logger(AssistantApplicationService.name);

  constructor(
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    private readonly applicationService: ApplicationService,
    private readonly applicationManifestMigrationService: ApplicationManifestMigrationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  /**
   * Optional install path. Does not run on workspace init.
   * Prefer `installIfAlreadyPresent` for upgrades so clean/GTM workspaces stay uninstalled.
   */
  async synchronizeAssistantApplicationOrThrow({
    workspaceId,
    isOrgChartEnabled,
  }: {
    workspaceId: string;
    isOrgChartEnabled?: boolean;
  }): Promise<void> {
    const syncStart = performance.now();

    await this.applicationService.createAssistantApplication({
      workspaceId,
    });

    await this.transferOwnershipFromArxenaStandard({ workspaceId });

    const assistantFlatApplication =
      await this.findAssistantFlatApplicationOrThrow({
        workspaceId,
      });

    const manifest = buildAssistantManifest(isOrgChartEnabled);

    try {
      await this.applicationManifestMigrationService.syncMetadataFromManifest({
        manifest,
        workspaceId,
        ownerFlatApplication: assistantFlatApplication,
      });
    } catch (error) {
      if (error instanceof WorkspaceMigrationBuilderException) {
        this.logger.error(formatValidationErrors(error));
      }

      throw error;
    }

    this.logger.log(
      `Assistant application sync completed in ${(performance.now() - syncStart).toFixed(0)}ms`,
    );
  }

  /**
   * Install + transfer only when the workspace already has assistantThread
   * (legacy Arxena Standard). New / GTM-only workspaces stay uninstalled
   * until an explicit install.
   */
  async installIfAlreadyPresent({
    workspaceId,
    isOrgChartEnabled,
  }: {
    workspaceId: string;
    isOrgChartEnabled?: boolean;
  }): Promise<boolean> {
    const existingRows: Array<{ id: string }> =
      await this.coreDataSource.query(
        `
          SELECT id
          FROM core."objectMetadata"
          WHERE "workspaceId" = $1
            AND "nameSingular" = ANY($2::text[])
          LIMIT 1
        `,
        [workspaceId, [...ASSISTANT_OBJECT_NAME_SINGULARS]],
      );

    if (existingRows.length === 0) {
      this.logger.log(
        `Skipping assistant install for workspace ${workspaceId} (no legacy objects; app stays uninstalled)`,
      );

      return false;
    }

    await this.synchronizeAssistantApplicationOrThrow({
      workspaceId,
      isOrgChartEnabled,
    });

    return true;
  }

  async transferOwnershipFromArxenaStandard({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<void> {
    const assistantApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier: ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (!isDefined(assistantApplication)) {
      throw new ApplicationException(
        `Assistant application not found for workspace ${workspaceId}`,
        ApplicationExceptionCode.APPLICATION_NOT_FOUND,
      );
    }

    const applicationId = assistantApplication.id;
    const objectNames = [...ASSISTANT_OBJECT_NAME_SINGULARS];
    const commandMenuItemUniversalIdentifiers = [
      ...ASSISTANT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS,
    ];

    const objectRows: Array<{ id: string }> = await this.coreDataSource.query(
      `
        SELECT id
        FROM core."objectMetadata"
        WHERE "workspaceId" = $1
          AND "nameSingular" = ANY($2::text[])
      `,
      [workspaceId, objectNames],
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

    for (const hostField of ASSISTANT_HOST_EXTENSION_FIELDS) {
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

    if (commandMenuItemUniversalIdentifiers.length > 0) {
      await this.coreDataSource.query(
        `
          UPDATE core."commandMenuItem"
          SET "applicationId" = $1
          WHERE "workspaceId" = $2
            AND "universalIdentifier" = ANY($3::uuid[])
        `,
        [applicationId, workspaceId, commandMenuItemUniversalIdentifiers],
      );
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatApplicationMaps',
      ...ALL_FLAT_ENTITY_MAPS_PROPERTIES,
    ]);
  }

  private async findAssistantFlatApplicationOrThrow({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<FlatApplication> {
    const assistantApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier: ASSISTANT_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (!isDefined(assistantApplication)) {
      throw new ApplicationException(
        `Assistant application not found for workspace ${workspaceId}`,
        ApplicationExceptionCode.APPLICATION_NOT_FOUND,
      );
    }

    return fromApplicationEntityToFlatApplication(assistantApplication);
  }
}
