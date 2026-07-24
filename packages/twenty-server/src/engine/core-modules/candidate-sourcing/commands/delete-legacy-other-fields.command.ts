import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { MigrateOtherFieldsService } from '../services/migrate-other-fields.service';

type DeleteLegacyOtherFieldsCommandOptions = {
  workspaceId?: string;
  dryRun?: boolean;
};

@Command({
  name: 'candidate-sourcing:delete-legacy-other-fields',
  description:
    'Delete legacy _candidateField and _candidateFieldValue rows after otherFields migration.',
})
export class DeleteLegacyOtherFieldsCommand extends CommandRunner {
  private readonly logger = new Logger(DeleteLegacyOtherFieldsCommand.name);

  constructor(
    private readonly migrateOtherFieldsService: MigrateOtherFieldsService,
  ) {
    super();
  }

  @Option({
    flags: '-w, --workspace-id [workspace_id]',
    description: 'Delete legacy rows for a single workspace (defaults to all workspaces)',
    required: false,
  })
  parseWorkspaceId(workspaceId: string): string {
    return workspaceId;
  }

  @Option({
    flags: '-d, --dry-run',
    description: 'Log row counts without deleting',
    required: false,
  })
  parseDryRun(): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: DeleteLegacyOtherFieldsCommandOptions,
  ): Promise<void> {
    const workspaceIds = options.workspaceId ? [options.workspaceId] : undefined;

    this.logger.log(
      `Starting legacy otherFields cleanup${options.dryRun ? ' (dry run)' : ''}`,
    );

    const results = await this.migrateOtherFieldsService.deleteLegacyForAllWorkspaces(
      {
        workspaceIds,
        dryRun: options.dryRun,
      },
    );

    let totalFieldValuesDeleted = 0;
    let totalFieldsDeleted = 0;
    let skippedWorkspaces = 0;

    for (const result of results) {
      if (result.skipped) {
        skippedWorkspaces++;
        this.logger.warn(
          `Skipped workspace ${result.workspaceId}: ${result.skipReason ?? 'unknown reason'}`,
        );
        continue;
      }

      totalFieldValuesDeleted += result.legacyFieldValuesDeleted;
      totalFieldsDeleted += result.legacyFieldsDeleted;

      this.logger.log(
        `Workspace ${result.workspaceId} (${result.schema}): deletedFieldValues=${result.legacyFieldValuesDeleted}, deletedFields=${result.legacyFieldsDeleted}`,
      );
    }

    this.logger.log(
      `Done. Workspaces=${results.length}, skipped=${skippedWorkspaces}, legacyFieldValuesDeleted=${totalFieldValuesDeleted}, legacyFieldsDeleted=${totalFieldsDeleted}`,
    );
  }
}
