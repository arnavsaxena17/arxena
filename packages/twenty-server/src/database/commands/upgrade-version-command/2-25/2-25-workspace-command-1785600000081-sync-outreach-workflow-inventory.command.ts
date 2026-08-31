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
import {
  SEEDED_OUTREACH_WORKFLOW,
  getSeededOutreachWorkflowRenamePairs,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import {
  deactivateObsoleteOutreachWorkflows,
  deactivateOutreachWorkflowsByName,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/outreach-workflow-cleanup.util';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000081)
@Command({
  name: 'upgrade:2-25:sync-outreach-workflow-inventory',
  description:
    'Deactivate obsolete outreach workflows, rename legacy GTM display names to neutral Outreach spine, and resync seeded draft graphs (including Fetch & Save)',
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
      for (const { from, to } of getSeededOutreachWorkflowRenamePairs()) {
        this.logger.log(`Would rename workflow "${from}" → "${to}"`);
      }

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

      for (const { from, to } of getSeededOutreachWorkflowRenamePairs()) {
        const canonicalRows = (await queryRunner.manager.query(
          `
            SELECT id
            FROM ${schemaName}.workflow
            WHERE name = $1
              AND "deletedAt" IS NULL
            LIMIT 1
          `,
          [to],
        )) as Array<{ id: string }>;

        if (canonicalRows.length > 0) {
          const { workflowIds: duplicateIds } =
            await deactivateOutreachWorkflowsByName({
              schemaName,
              entityManager: queryRunner.manager,
              workflowNames: [from],
            });

          if (duplicateIds.length > 0) {
            this.logger.log(
              `Deactivated duplicate "${from}" (${duplicateIds.length}) — canonical "${to}" already exists`,
            );
          }

          continue;
        }

        const workspaceRows = (await queryRunner.manager.query(
          `
            UPDATE ${schemaName}.workflow
            SET name = $2, "updatedAt" = NOW()
            WHERE name = $1
              AND "deletedAt" IS NULL
            RETURNING id, "coreWorkflowId"
          `,
          [from, to],
        )) as Array<{ id: string; coreWorkflowId: string | null }>;

        if (workspaceRows.length === 0) {
          continue;
        }

        await queryRunner.manager.query(
          `
            UPDATE ${schemaName}."workflowVersion"
            SET name = $2, "updatedAt" = NOW()
            WHERE name = $1
              AND "deletedAt" IS NULL
          `,
          [from, to],
        );

        const coreIds = workspaceRows
          .map((row) => row.coreWorkflowId)
          .filter((id): id is string => typeof id === 'string');

        if (coreIds.length > 0) {
          await queryRunner.manager.query(
            `
              UPDATE core.workflow
              SET name = $2
              WHERE id = ANY($1)
            `,
            [coreIds, to],
          );
        }

        this.logger.log(
          `Renamed ${workspaceRows.length} workflow(s) "${from}" → "${to}"`,
        );
      }

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
