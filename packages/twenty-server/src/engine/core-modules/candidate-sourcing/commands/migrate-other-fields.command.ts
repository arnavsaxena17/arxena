import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { MigrateOtherFieldsService } from '../services/migrate-other-fields.service';

type MigrateOtherFieldsCommandOptions = {
  workspaceId?: string;
  dryRun?: boolean;
  deleteLegacy?: boolean;
  batchSize?: number;
};

@Command({
  name: 'candidate-sourcing:migrate-other-fields',
  description:
    'Bulk-migrate legacy candidateField/candidateFieldValue rows into job.chatQuestions and candidate.otherFields for all workspaces (local and production).',
})
export class MigrateOtherFieldsCommand extends CommandRunner {
  private readonly logger = new Logger(MigrateOtherFieldsCommand.name);

  constructor(
    private readonly migrateOtherFieldsService: MigrateOtherFieldsService,
  ) {
    super();
  }

  @Option({
    flags: '-w, --workspace-id [workspace_id]',
    description: 'Migrate a single workspace (defaults to all workspaces)',
    required: false,
  })
  parseWorkspaceId(workspaceId: string): string {
    return workspaceId;
  }

  @Option({
    flags: '-d, --dry-run',
    description: 'Log planned changes without writing to the database',
    required: false,
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '-l, --delete-legacy',
    description:
      'Delete legacy _candidateField and _candidateFieldValue rows after migration',
    required: false,
  })
  parseDeleteLegacy(): boolean {
    return true;
  }

  @Option({
    flags: '-b, --batch-size [batch_size]',
    description: 'Candidate batch size (default: 200)',
    required: false,
  })
  parseBatchSize(batchSize: string): number {
    return Number(batchSize);
  }

  async run(
    _passedParams: string[],
    options: MigrateOtherFieldsCommandOptions,
  ): Promise<void> {
    const workspaceIds = options.workspaceId ? [options.workspaceId] : undefined;

    this.logger.log(
      `Starting otherFields migration${options.dryRun ? ' (dry run)' : ''}${options.deleteLegacy ? ' with legacy delete' : ''}`,
    );
    this.logger.log(`Options: ${JSON.stringify(options)}`);

    const results = await this.migrateOtherFieldsService.migrateAllWorkspaces({
      workspaceIds,
      dryRun: options.dryRun,
      deleteLegacy: options.deleteLegacy,
      batchSize: options.batchSize,
    });

    let totalJobs = 0;
    let totalCandidates = 0;
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

      totalJobs += result.jobsUpdated;
      totalCandidates += result.candidatesUpdated;
      totalFieldValuesDeleted += result.legacyFieldValuesDeleted;
      totalFieldsDeleted += result.legacyFieldsDeleted;

      this.logger.log(
        `Workspace ${result.workspaceId} (${result.schema}): jobs=${result.jobsUpdated}, candidates=${result.candidatesUpdated}, deletedFieldValues=${result.legacyFieldValuesDeleted}, deletedFields=${result.legacyFieldsDeleted}`,
      );
    }

    this.logger.log(
      `Done. Workspaces=${results.length}, skipped=${skippedWorkspaces}, jobsUpdated=${totalJobs}, candidatesUpdated=${totalCandidates}, legacyFieldValuesDeleted=${totalFieldValuesDeleted}, legacyFieldsDeleted=${totalFieldsDeleted}`,
    );
  }
}
