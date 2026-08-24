import { Command } from 'nest-commander';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { MigrateOtherFieldsService } from 'src/engine/core-modules/candidate-sourcing/services/migrate-other-fields.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000051)
@Command({
  name: 'upgrade:2-25:drop-candidate-field-objects',
  description:
    'Migrate candidateField/candidateFieldValue rows into candidate.otherFields and project.chatQuestions, then drop those objects from existing workspaces',
})
export class DropCandidateFieldObjectsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly migrateOtherFieldsService: MigrateOtherFieldsService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Migrating otherFields and dropping candidateField objects for workspace ${workspaceId}`,
    );

    const result = await this.migrateOtherFieldsService.migrateWorkspace(
      schema,
      workspaceId,
      {
        dryRun: isDryRun,
        deleteLegacy: !isDryRun,
      },
    );

    if (result.skipped) {
      this.logger.warn(
        `Skipped otherFields data migration for workspace ${workspaceId}: ${result.skipReason ?? 'unknown reason'}`,
      );
    } else {
      this.logger.log(
        `Workspace ${workspaceId}: projects=${result.jobsUpdated}, candidates=${result.candidatesUpdated}, deletedFieldValues=${result.legacyFieldValuesDeleted}, deletedFields=${result.legacyFieldsDeleted}`,
      );
    }

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Synced Arxena standard application (candidateField objects removed) for workspace ${workspaceId}`,
    );
  }
}
