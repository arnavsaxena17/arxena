import { Command } from 'nest-commander';

import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/engine/workspace-manager/shortlist-presentation-application/constants/shortlist-presentation-application.constant';
import { ShortlistPresentationApplicationService } from 'src/engine/workspace-manager/shortlist-presentation-application/services/shortlist-presentation-application.service';

@RegisteredWorkspaceCommand('2.25.0', 1785600000086)
@Command({
  name: 'upgrade:2-25:move-candidate-enrichment-to-arxena-standard',
  description:
    'Move candidateEnrichment metadata ownership from Shortlist Presentation to Arxena Standard, then resync both manifests so AI filtering works on all workspaces.',
})
export class MoveCandidateEnrichmentToArxenaStandardCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly shortlistPresentationApplicationService: ShortlistPresentationApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Moving candidateEnrichment to Arxena Standard for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const transferred =
      await this.arxenaStandardApplicationService.transferCandidateEnrichmentOwnershipToArxenaStandard(
        { workspaceId },
      );

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const shortlistPresentationApplication =
      await this.applicationService.findByUniversalIdentifier({
        universalIdentifier:
          SHORTLIST_PRESENTATION_APPLICATION_UNIVERSAL_IDENTIFIER,
        workspaceId,
      });

    if (isDefined(shortlistPresentationApplication)) {
      await this.shortlistPresentationApplicationService.synchronizeShortlistPresentationApplicationOrThrow(
        { workspaceId },
      );
    }

    this.logger.log(
      transferred
        ? `Moved existing candidateEnrichment metadata to Arxena Standard for workspace ${workspaceId}`
        : `Seeded candidateEnrichment on Arxena Standard for workspace ${workspaceId}`,
    );
  }
}
