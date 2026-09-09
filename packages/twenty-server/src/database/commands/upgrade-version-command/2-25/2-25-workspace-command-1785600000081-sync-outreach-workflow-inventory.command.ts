import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { deactivateObsoleteOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/outreach-workflow-cleanup.util';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000081)
@Command({
  name: 'upgrade:2-25:sync-outreach-workflow-inventory',
  description:
    'Deactivate obsolete outreach workflows and resync seeded draft graphs (including Fetch & Save)',
})
export class SyncOutreachWorkflowInventoryCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Syncing outreach workflow inventory for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      this.logger.log(
        `Would deactivate obsolete outreach workflows and resync ${Object.values(SEEDED_OUTREACH_WORKFLOW).length} seeded graphs`,
      );

      return;
    }

    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const { workflowIds: deactivatedIds } =
        await deactivateObsoleteOutreachWorkflows({
          schemaName,
          entityManager: queryRunner.manager,
        });

      this.logger.log(
        `Deactivated ${deactivatedIds.length} obsolete outreach workflow(s)`,
      );

      const dashboardRenames = (await queryRunner.manager.query(
        `
          UPDATE ${schemaName}.dashboard
          SET title = 'Outreach', "updatedAt" = NOW()
          WHERE title = 'GTM Command'
            AND "deletedAt" IS NULL
          RETURNING id
        `,
      )) as Array<{ id: string }>;

      this.logger.log(
        `Renamed ${dashboardRenames.length} dashboard(s) "GTM Command" → "Outreach"`,
      );

      await prefillOutreachWorkflows({
        entityManager: queryRunner.manager,
        workspaceId,
        schemaName,
        applicationId: workspaceCustomFlatApplication.id,
        replaceExistingDrafts: true,
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatAgentMaps',
      'workflowAutomatedTriggerMaps',
    ]);

    this.logger.log(
      `Outreach workflow inventory sync complete for workspace ${workspaceId} (${Object.values(SEEDED_OUTREACH_WORKFLOW).length} seeded graphs)`,
    );
  }
}
