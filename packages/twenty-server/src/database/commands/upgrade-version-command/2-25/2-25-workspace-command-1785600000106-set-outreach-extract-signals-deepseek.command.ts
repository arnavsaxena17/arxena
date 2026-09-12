import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import {
  OUTREACH_EXTRACT_SIGNALS_AGENT_NAME,
  OUTREACH_EXTRACT_SIGNALS_MODEL_ID,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000106)
@Command({
  name: 'upgrade:2-25:set-outreach-extract-signals-deepseek',
  description:
    'Point GTM inbound signal extraction agent at DeepSeek V4 Flash instead of default-fast (Gemini Flash)',
})
export class SetOutreachExtractSignalsDeepseekCommand extends ProvisionedWorkspaceCommandRunner {
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

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Setting extract-signals agent to DeepSeek for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.coreDataSource.query(
      `
        UPDATE core.agent
        SET "modelId" = $1
        WHERE name = $2
          AND "workspaceId" = $3
          AND "deletedAt" IS NULL
      `,
      [
        OUTREACH_EXTRACT_SIGNALS_MODEL_ID,
        OUTREACH_EXTRACT_SIGNALS_AGENT_NAME,
        workspaceId,
      ],
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatAgentMaps',
    ]);

    this.logger.log(
      `Extract-signals agent set to DeepSeek for workspace ${workspaceId}`,
    );
  }
}
