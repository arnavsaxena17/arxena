import { Logger } from '@nestjs/common';

import { Command, CommandRunner, Option } from 'nest-commander';

import { WorkspaceBulkMetadataUpdateService } from '../workspace-bulk-metadata-update.service';

type UpdateAllWorkspacesMetadataCommandOptions = {
  origin?: string;
};

@Command({
  name: 'workspace:update-all-metadata-from-code',
  description:
    'Applies fields/objects/relations code metadata and DB indices for each workspace that has API keys (same as admin POST update-all-workspaces-metadata).',
})
export class UpdateAllWorkspacesMetadataCommand extends CommandRunner {
  private readonly logger = new Logger(UpdateAllWorkspacesMetadataCommand.name);

  constructor(
    private readonly workspaceBulkMetadataUpdateService: WorkspaceBulkMetadataUpdateService,
  ) {
    super();
  }

  @Option({
    flags: '-o, --origin [origin]',
    description:
      'Origin value for GraphQL calls (defaults to METADATA_UPDATE_ORIGIN, then FRONTEND_URL, then empty)',
    required: false,
  })
  origin(val?: string): string | undefined {
    return val;
  }

  async run(
    _passedParams: string[],
    options: UpdateAllWorkspacesMetadataCommandOptions,
  ): Promise<void> {
    const origin =
      options.origin ??
      process.env.METADATA_UPDATE_ORIGIN ??
      process.env.FRONTEND_URL ??
      '';

    this.logger.log(
      `Starting bulk metadata update (origin="${origin || '(empty)'}")`,
    );

    const result =
      await this.workspaceBulkMetadataUpdateService.updateAllWorkspacesMetadata(
        origin,
      );

    this.logger.log(result.message);
    for (const r of result.results) {
      if (r.errors.length > 0) {
        this.logger.warn(`Workspace ${r.workspaceId}: ${r.errors.join('; ')}`);
      }
    }
    this.logger.log(
      `Finished: ${result.results.length} workspace(s) processed.`,
    );
  }
}
