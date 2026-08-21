import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { prefillGtmOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-gtm-outreach-workflows.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000038)
@Command({
  name: 'upgrade:2-25:prefill-gtm-outreach-workflows',
  description:
    'Insert GTM outreach sequencer workflows as Drafts on existing workspaces (skip names already present)',
})
export class PrefillGtmOutreachWorkflowsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Prefilling GTM outreach draft workflows for workspace ${workspaceId}`,
    );

    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    if (isDryRun) {
      return;
    }

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      await prefillGtmOutreachWorkflows({
        entityManager: queryRunner.manager,
        workspaceId,
        schemaName,
        applicationId: workspaceCustomFlatApplication.id,
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

    this.logger.log(
      `Prefill GTM outreach draft workflows complete for workspace ${workspaceId}`,
    );
  }
}
