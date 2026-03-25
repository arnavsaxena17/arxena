import { Logger } from '@nestjs/common';

import chalk from 'chalk';
import { Command, CommandRunner } from 'nest-commander';

import { WorkspaceQueryService } from '../workspace-modifications.service';

@Command({
  name: 'unipile:backfill-member-mappings',
  description:
    'Populate metadata.unipile_accounts from tenant workspaceMemberProfile linkedin/whatsapp Unipile columns.',
})
export class UnipileBackfillMemberMappingsCommand extends CommandRunner {
  private readonly logger = new Logger(UnipileBackfillMemberMappingsCommand.name);

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {
    super();
  }

  async run(): Promise<void> {
    this.logger.log(
      chalk.blue('Backfilling Unipile member ↔ workspace mappings...'),
    );
    const result =
      await this.workspaceQueryService.backfillUnipileMemberAccountMappingsFromTenantProfiles();
    this.logger.log(
      chalk.green(
        `Done. workspacesScanned=${result.workspacesScanned} mappingsWritten=${result.mappingsWritten}`,
      ),
    );
  }
}
