import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { OUTREACH_DASHBOARD_TITLE } from 'src/engine/workspace-manager/arxena-standard-metadata/utils/build-outreach-dashboard-page-layout.util';
import { prefillOutreachDashboard } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-dashboards.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000057)
@Command({
  name: 'upgrade:2-25:prefill-gtm-command-dashboard',
  description:
    'Sync the Outreach dashboard page layout and insert the dashboard record on existing workspaces (skip if already titled Outreach)',
})
export class PrefillOutreachCommandDashboardCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;
    const schemaName = getWorkspaceSchemaName(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Prefilling ${OUTREACH_DASHBOARD_TITLE} dashboard for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatPageLayoutMaps',
    ]);

    const { flatPageLayoutMaps } = await this.workspaceCacheService.getOrRecompute(
      workspaceId,
      ['flatPageLayoutMaps'],
    );

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const result = await prefillOutreachDashboard({
        entityManager: queryRunner.manager,
        schemaName,
        flatPageLayoutMaps,
      });

      await queryRunner.commitTransaction();

      if (result === 'skipped-missing-layout') {
        throw new Error(
          `${OUTREACH_DASHBOARD_TITLE} page layout was not found after Arxena standard sync for workspace ${workspaceId}`,
        );
      }

      this.logger.log(
        `${OUTREACH_DASHBOARD_TITLE} dashboard ${result} for workspace ${workspaceId}`,
      );
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }
};
