import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { retireDuplicateOutreachSequencerWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/outreach-workflow-cleanup.util';
import { getOutreachWorkflowPrefillIds } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000189)
@Command({
  name: 'upgrade:2-25:retire-duplicate-outreach-sequencers',
  description:
    'Keep one "Outreach — Candidate Sequencer" per workspace (the seeded one): deactivate same-name copies and move their Projects to it',
})
export class RetireDuplicateOutreachSequencersCommand extends ProvisionedWorkspaceCommandRunner {
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
    const seededSequencerWorkflowId =
      getOutreachWorkflowPrefillIds(workspaceId).candidateSequencer.workflowId;

    if (isDryRun) {
      const sequencers = (await this.coreDataSource.query(
        `
          SELECT id
          FROM ${schemaName}.workflow
          WHERE name = $1
            AND "deletedAt" IS NULL
        `,
        [SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name],
      )) as Array<{ id: string }>;

      this.logger.log(
        `[DRY RUN] ${sequencers.length} Candidate Sequencer(s) in workspace ${workspaceId}; would keep ${seededSequencerWorkflowId} or the oldest`,
      );

      return;
    }

    const queryRunner = this.coreDataSource.createQueryRunner();
    let retiredWorkflowIds: string[] = [];
    let keptWorkflowId: string | null = null;

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const result = await retireDuplicateOutreachSequencerWorkflows({
        schemaName,
        entityManager: queryRunner.manager,
        seededSequencerWorkflowId,
      });

      retiredWorkflowIds = result.workflowIds;
      keptWorkflowId = result.keptWorkflowId;

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }

    if (retiredWorkflowIds.length === 0) {
      return;
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'workflowAutomatedTriggerMaps',
    ]);

    this.logger.log(
      `Retired ${retiredWorkflowIds.length} duplicate Candidate Sequencer(s) [${retiredWorkflowIds.join(', ')}] in workspace ${workspaceId}; kept ${keptWorkflowId}`,
    );
  }
}
