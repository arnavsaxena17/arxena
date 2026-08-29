import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

/** One-shot display-name renames from the old GTM-prefixed seeds. */
const WORKFLOW_RENAMES: Array<{ from: string; to: string }> = [
  {
    from: 'GTM Harvest — LinkedIn Companies',
    to: 'Harvest — LinkedIn Companies',
  },
  {
    from: 'GTM Outreach — Per Candidate',
    to: 'Outreach — Per Enrolled Person',
  },
  {
    from: 'GTM Outreach — Candidate Updated',
    to: 'Outreach — Enrolled Person Updated',
  },
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000074)
@Command({
  name: 'upgrade:2-25:rename-gtm-seeded-outreach-workflow-names',
  description:
    'Rename seeded GTM-prefixed outreach workflow display names to neutral CRM spine names',
})
export class RenameOutreachSeededOutreachWorkflowNamesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Renaming seeded outreach workflow names for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      for (const { from, to } of WORKFLOW_RENAMES) {
        this.logger.log(`Would rename workflow "${from}" → "${to}"`);
      }

      return;
    }

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      for (const { from, to } of WORKFLOW_RENAMES) {
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
      `Rename seeded outreach workflow names complete for workspace ${workspaceId}`,
    );
  }
}
