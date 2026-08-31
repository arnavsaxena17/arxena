import { Command } from 'nest-commander';

import { isNonEmptyString } from '@sniptt/guards';
import { backfillOutreachActionTimestampsFromCandidate } from 'twenty-shared/arx';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { candidateStageImpliesOutbound } from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';

type CandidateRow = ObjectLiteral & {
  id: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  firstOutboundAt?: string | Date | null;
  lastOutboundAt?: string | Date | null;
  lastInboundAt?: string | Date | null;
  outreachSequenceStage?: string | null;
  outreachSpeedTimestamps?: unknown;
  daysToFirstContact?: number | null;
  daysToMeetingBooked?: number | null;
};

const toIso = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000083)
@Command({
  name: 'upgrade:2-25:sync-outreach-candidate-speed-fields',
  description:
    'Add Candidate outreach speed timestamp fields, sync dashboard Speed tab, and backfill metrics from existing outreach activity',
})
export class SyncOutreachCandidateSpeedFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Syncing outreach candidate speed fields for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const authContext = buildSystemAuthContext(workspaceId);
    let stampedCandidates = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRow>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const candidates = await candidateRepository.find({ take: 20_000 });

        for (const candidate of candidates) {
          if (
            !candidateStageImpliesOutbound(candidate.outreachSequenceStage) &&
            !isNonEmptyString(toIso(candidate.firstOutboundAt)) &&
            candidate.outreachSequenceStage !== 'MEETING_BOOKED'
          ) {
            continue;
          }

          const speedUpdate = backfillOutreachActionTimestampsFromCandidate({
            createdAt: toIso(candidate.createdAt),
            firstOutboundAt: toIso(candidate.firstOutboundAt),
            lastOutboundAt: toIso(candidate.lastOutboundAt),
            lastInboundAt: toIso(candidate.lastInboundAt),
            updatedAt: toIso(candidate.updatedAt),
            outreachSequenceStage: candidate.outreachSequenceStage,
            existingTimestamps: candidate.outreachSpeedTimestamps,
          });

          const hasSpeedMetrics =
            candidate.daysToFirstContact !== null &&
            candidate.daysToFirstContact !== undefined &&
            candidate.outreachSpeedTimestamps !== null &&
            candidate.outreachSpeedTimestamps !== undefined;

          if (
            hasSpeedMetrics &&
            candidate.daysToFirstContact === speedUpdate.daysToFirstContact &&
            candidate.daysToMeetingBooked === speedUpdate.daysToMeetingBooked
          ) {
            continue;
          }

          await candidateRepository.update(candidate.id, speedUpdate);
          stampedCandidates += 1;
        }
      },
      authContext,
    );

    this.logger.log(
      `Backfilled outreach speed metrics on ${stampedCandidates} candidates for workspace ${workspaceId}`,
    );
  }
}
