import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

// Only the two graphs carrying the REPLIED branch are rewritten; the other
// seeded templates keep whatever the workspace has.
const GRAPHS_WITH_REPLIED_BRANCH = [
  SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
  SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
] as const;

@RegisteredWorkspaceCommand('2.25.0', 1785600000101)
@Command({
  name: 'upgrade:2-25:split-outreach-reply-agent',
  description:
    'Split "Draft sales reply" into Extract inbound signals (agent) → Validate inbound signals (logic function) → Draft sales reply (copy only), and repoint the approval form onto the validated signals',
})
export class SplitOutreachReplyAgentCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Splitting outreach reply agent for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    // validate-inbound-signals must exist before the graphs reference it.
    await this.prefillLogicFunctionService.ensureSeeded({
      workspaceId,
      definitions: getOutreachLogicFunctionDefinitions(workspaceId),
    });

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const schemaName = getWorkspaceSchemaName(workspaceId);
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
        onlyGraphNames: GRAPHS_WITH_REPLIED_BRANCH,
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
      `Outreach reply agent split for workspace ${workspaceId}`,
    );
  }
}
