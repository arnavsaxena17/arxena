import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

const CANDIDATE_TABLE_NAME = '_candidate';

@RegisteredWorkspaceCommand('2.25.0', 1785600000090)
@Command({
  name: 'upgrade:2-25:sync-outreach-conversation-stage-and-workflow-c',
  description:
    'Add Candidate outreachConversationStage / WAITING_REPLY, rename LEAD_LOST/IRRELEVANT to NOT_INTERESTED, and collapse Enrolled Person Updated inbound branches into one sales agent plus 3-day wait',
})
export class SyncOutreachConversationStageAndWorkflowCCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceQueryService: WorkspaceQueryService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Syncing outreach conversation stage and workflow C for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.remapLegacyConversationStages({
      schemaName,
      workspaceId,
    });

    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

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
      `Outreach conversation stage and workflow C sync complete for workspace ${workspaceId}`,
    );
  }

  // Arxena Candidate physical table is `_candidate` (custom object), not `candidate`
  private async remapLegacyConversationStages({
    schemaName,
    workspaceId,
  }: {
    schemaName: string;
    workspaceId: string;
  }): Promise<void> {
    const tableExists = await this.workspaceQueryService.checkIfTableExists(
      schemaName,
      CANDIDATE_TABLE_NAME,
    );

    if (!tableExists) {
      this.logger.log(
        `Workspace ${workspaceId}: ${CANDIDATE_TABLE_NAME} table missing; skipping LEAD_LOST/IRRELEVANT remap`,
      );

      return;
    }

    const columnExists = await this.workspaceQueryService.checkIfColumnExists(
      schemaName,
      CANDIDATE_TABLE_NAME,
      'outreachConversationStage',
      { silent: true },
    );

    if (!columnExists) {
      this.logger.log(
        `Workspace ${workspaceId}: outreachConversationStage column missing; skipping LEAD_LOST/IRRELEVANT remap`,
      );

      return;
    }

    await this.coreDataSource.query(
      `
        UPDATE "${schemaName}"."${CANDIDATE_TABLE_NAME}"
        SET "outreachConversationStage" = 'NOT_INTERESTED'
        WHERE "outreachConversationStage" IN ('LEAD_LOST', 'IRRELEVANT')
          AND "deletedAt" IS NULL
      `,
    );

    this.logger.log(
      `Remapped LEAD_LOST/IRRELEVANT → NOT_INTERESTED for workspace ${workspaceId}`,
    );
  }
}
