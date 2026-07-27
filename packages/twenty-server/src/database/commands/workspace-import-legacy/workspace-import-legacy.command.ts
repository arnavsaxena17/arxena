import { Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { Command, CommandRunner, Option } from 'nest-commander';

import { WorkspaceImportLegacyService } from 'src/database/commands/workspace-import-legacy/workspace-import-legacy.service';

type WorkspaceImportLegacyOptions = {
  sourceDatabaseUrl?: string;
  workspaceId?: string[];
  dryRun?: boolean;
};

@Command({
  name: 'workspace:import-legacy',
  description:
    'Import workspaces from a legacy Twenty/Arxena dump DB into the current schema (activate + ETL)',
})
export class WorkspaceImportLegacyCommand extends CommandRunner {
  private readonly logger = new Logger(WorkspaceImportLegacyCommand.name);

  constructor(
    private readonly workspaceImportLegacyService: WorkspaceImportLegacyService,
  ) {
    super();
  }

  @Option({
    flags: '-s, --source-database-url <url>',
    description:
      'Postgres URL of the restored legacy dump (e.g. postgres://postgres:postgres@localhost:5432/arxena_legacy_local)',
    required: true,
  })
  parseSourceDatabaseUrl(value: string): string {
    return value;
  }

  @Option({
    flags: '-w, --workspace-id <workspace_id>',
    description: 'Optional workspace UUID filter (repeatable)',
  })
  parseWorkspaceId(value: string, previous: string[] = []): string[] {
    return [...previous, value];
  }

  @Option({
    flags: '--dry-run',
    description: 'Log workspaces that would be imported without writing',
  })
  parseDryRun(): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: WorkspaceImportLegacyOptions,
  ): Promise<void> {
    if (!isNonEmptyString(options.sourceDatabaseUrl)) {
      throw new Error('--source-database-url is required');
    }

    this.logger.log(
      `Starting legacy import from ${options.sourceDatabaseUrl}${
        options.dryRun === true ? ' (dry run)' : ''
      }`,
    );

    await this.workspaceImportLegacyService.importFromSourceDatabaseUrl({
      sourceDatabaseUrl: options.sourceDatabaseUrl,
      workspaceIds: options.workspaceId,
      dryRun: options.dryRun === true,
    });

    this.logger.log('Legacy import finished');
  }
}
