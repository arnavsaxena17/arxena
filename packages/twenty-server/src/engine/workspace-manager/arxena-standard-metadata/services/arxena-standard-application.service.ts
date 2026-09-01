import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

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
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import {
  ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER,
  CANDIDATE_ENRICHMENT_HOST_EXTENSION_FIELDS,
  CANDIDATE_ENRICHMENT_OBJECT_NAME_SINGULAR,
} from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';
import { buildArxenaStandardManifest } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-arxena-standard-manifest.util';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';

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
