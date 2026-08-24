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
import { buildShortlistPresentationManifest } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-arxena-standard-manifest.util';
import {
  SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER,
  SHORTLIST_PRESENTATION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS,
  SHORTLIST_PRESENTATION_HOST_EXTENSION_FIELDS,
  SHORTLIST_PRESENTATION_OBJECT_NAME_SINGULARS,
} from 'src/engine/workspace-manager/shortlist-presentation-application/constants/shortlist-presentation-application.constant';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';

@Injectable()
export class ShortlistPresentationApplicationService {
  private readonly logger = new Logger(
    ShortlistPresentationApplicationService.name,
  );

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
  async synchronizeShortlistPresentationApplicationOrThrow({
    workspaceId,
    isOrgChartEnabled,
  }: {
    workspaceId: string;
    isOrgChartEnabled?: boolean;
  }): Promise<void> {
    const syncStart = performance.now();

    await this.applicationService.createShortlistPresentationApplication({
      workspaceId,
    });

    await this.transferOwnershipFromArxenaStandard({ workspaceId });

    const shortlistPresentationFlatApplication =
      await this.findShortlistPresentationFlatApplicationOrThrow({
        workspaceId,
      });

    const manifest = buildShortlistPresentationManifest(isOrgChartEnabled);

    try {
      await this.applicationManifestMigrationService.syncMetadataFromManifest({
        manifest,
        workspaceId,
        ownerFlatApplication: shortlistPresentationFlatApplication,
      });
    } catch (error) {
      if (error instanceof WorkspaceMigrationBuilderException) {
        this.logger.error(formatValidationErrors(error));
      }

      throw error;
    }

    this.logger.log(
      `Shortlist presentation application sync completed in ${(performance.now() - syncStart).toFixed(0)}ms`,
    );
  }

  /**
   * Install + transfer only when the workspace already has shortlist-domain
   * objects (legacy Arxena Standard). New / GTM-only workspaces stay
   * uninstalled until an explicit install.
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
        [workspaceId, [...SHORTLIST_PRESENTATION_OBJECT_NAME_SINGULARS]],
      );

    if (existingRows.length === 0) {
      this.logger.log(
        `Skipping shortlist presentation install for workspace ${workspaceId} (no legacy objects; app stays uninstalled)`,
      );

      return false;
    }

    await this.synchronizeShortlistPresentationApplicationOrThrow({
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
    const shortlistPresentationApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier:
          SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (!isDefined(shortlistPresentationApplication)) {
      throw new ApplicationException(
        `Shortlist presentation application not found for workspace ${workspaceId}`,
        ApplicationExceptionCode.APPLICATION_NOT_FOUND,
      );
    }

    const applicationId = shortlistPresentationApplication.id;
    const objectNames = [...SHORTLIST_PRESENTATION_OBJECT_NAME_SINGULARS];
    const commandMenuItemUniversalIdentifiers = [
      ...SHORTLIST_PRESENTATION_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIERS,
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

    for (const hostField of SHORTLIST_PRESENTATION_HOST_EXTENSION_FIELDS) {
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

    await this.coreDataSource.query(
      `
        UPDATE core."commandMenuItem"
        SET "applicationId" = $1
        WHERE "workspaceId" = $2
          AND "universalIdentifier" = ANY($3::uuid[])
      `,
      [applicationId, workspaceId, commandMenuItemUniversalIdentifiers],
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatApplicationMaps',
      ...ALL_FLAT_ENTITY_MAPS_PROPERTIES,
    ]);
  }

  private async findShortlistPresentationFlatApplicationOrThrow({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<FlatApplication> {
    const shortlistPresentationApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier:
          SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (!isDefined(shortlistPresentationApplication)) {
      throw new ApplicationException(
        `Shortlist presentation application not found for workspace ${workspaceId}`,
        ApplicationExceptionCode.APPLICATION_NOT_FOUND,
      );
    }

    return fromApplicationEntityToFlatApplication(
      shortlistPresentationApplication,
    );
  }
}
