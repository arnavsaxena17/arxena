import chalk from 'chalk';
import { Command, CommandRunner, Option } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { CommandLogger } from 'src/database/commands/logger';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type SyncArxenaStandardCommandOptions = {
  workspaceId?: Set<string>;
};

@Command({
  name: 'workspace:sync-arxena-standard',
  description:
    'Re-sync the Arxena standard application (objects + fields) onto provisioned workspaces. Required for new objects such as gtmWorkspaceProfile and before GTM Command dashboard seeding on existing workspaces.',
})
export class SyncArxenaStandardCommand extends CommandRunner {
  protected logger: CommandLogger;

  constructor(
    private readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super();
    this.logger = new CommandLogger({
      verbose: false,
      constructorName: this.constructor.name,
    });
  }

  @Option({
    flags: '-w, --workspace-id [workspace_id]',
    description:
      'workspace id. Command runs on all provisioned workspaces if not provided.',
    required: false,
  })
  parseWorkspaceId(val: string, previous?: Set<string>): Set<string> {
    const accumulator = previous ?? new Set<string>();

    accumulator.add(val);

    return accumulator;
  }

  override async run(
    _passedParams: string[],
    options: SyncArxenaStandardCommandOptions,
  ): Promise<void> {
    const workspaceIds = isDefined(options.workspaceId)
      ? Array.from(options.workspaceId)
      : undefined;

    const report = await this.workspaceIteratorService.iterate({
      workspaceIds,
      callback: async ({ workspaceId }) => {
        this.logger.log(
          chalk.blue(`Syncing Arxena standard application for ${workspaceId}`),
        );

        await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
          {
            workspaceId,
          },
        );

        this.logger.log(
          chalk.green(`Arxena standard sync completed for ${workspaceId}`),
        );
      },
    });

    this.logger.log(
      chalk.green(
        `Done. success=${report.success.length} failed=${report.fail.length}`,
      ),
    );

    if (report.fail.length > 0) {
      for (const failure of report.fail) {
        this.logger.error(
          `${failure.workspaceId}: ${
            failure.error instanceof Error
              ? failure.error.message
              : String(failure.error)
          }`,
        );
      }

      throw new Error(
        `Arxena standard sync failed for ${report.fail.length} workspace(s)`,
      );
    }
  }
}
