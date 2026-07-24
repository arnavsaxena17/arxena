import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { ApplicationManifestMigrationService } from 'src/engine/core-modules/application/application-manifest/application-manifest-migration.service';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { fromApplicationEntityToFlatApplication } from 'src/engine/core-modules/application/utils/from-application-entity-to-flat-application.util';
import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import {
  ApplicationException,
  ApplicationExceptionCode,
} from 'src/engine/core-modules/application/application.exception';
import { formatValidationErrors } from 'src/engine/core-modules/tool-provider/utils/format-validation-errors.util';
import { ARXENA_STANDARD_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/engine/workspace-manager/arxena-standard-metadata/constants/arxena-standard-application.constant';
import { buildArxenaStandardManifest } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-arxena-standard-manifest.util';
import { WorkspaceMigrationBuilderException } from 'src/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception';

@Injectable()
export class ArxenaStandardApplicationService {
  private readonly logger = new Logger(ArxenaStandardApplicationService.name);

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly applicationManifestMigrationService: ApplicationManifestMigrationService,
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
