import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

// Ensures ARX tenant indexes exist without runtime DDL in request handlers.
@RegisteredWorkspaceCommand('2.25.0', 1785600000006)
@Command({
  name: 'upgrade:2-25:ensure-arx-workspace-indexes',
  description:
    'Create ARX performance indexes on workspace schemas if missing',
})
export class EnsureArxWorkspaceIndexesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    if (options.dryRun === true) {
      this.logger.log(
        `Dry run: would ensure ARX indexes for workspace ${workspaceId}`,
      );

      return;
    }

    const schema = getWorkspaceSchemaName(workspaceId);
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_whatsapp_message_created_at ON "${schema}"."_whatsappMessage" ("createdAt")`,
      `CREATE INDEX IF NOT EXISTS idx_candidate_deleted_at ON "${schema}"."_candidate" ("deletedAt") WHERE "deletedAt" IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_projects_active ON "${schema}"."_project" ("isActive") WHERE "isActive" = true`,
    ];

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const dataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSource();

        for (const query of indexQueries) {
          try {
            await dataSource.query(query, [], undefined, {
              shouldBypassPermissionChecks: true,
            });
          } catch (error) {
            this.logger.warn(
              `Skipping index for workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
      authContext,
    );
  }
}
