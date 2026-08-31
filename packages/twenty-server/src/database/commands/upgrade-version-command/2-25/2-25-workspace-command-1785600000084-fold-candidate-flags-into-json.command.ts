import { Command } from 'nest-commander';

import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type CandidateRow = ObjectLiteral & {
  id: string;
  isProfilePurchased?: boolean | null;
  engagementStatus?: boolean | null;
  startChat?: boolean | null;
  startChatCompleted?: boolean | null;
  startVideoInterviewChat?: boolean | null;
  startVideoInterviewChatCompleted?: boolean | null;
  startMeetingSchedulingChat?: boolean | null;
  startMeetingSchedulingChatCompleted?: boolean | null;
  stopChat?: boolean | null;
  lastEngagementChatControl?: string | null;
  candidateFlags?: unknown;
};

const buildCandidateFlagsFromRow = (
  row: CandidateRow,
): Record<string, unknown> => ({
  isProfilePurchased: row.isProfilePurchased ?? false,
  engagementStatus: row.engagementStatus ?? false,
  startChat: row.startChat ?? false,
  startChatCompleted: row.startChatCompleted ?? false,
  startVideoInterviewChat: row.startVideoInterviewChat ?? false,
  startVideoInterviewChatCompleted:
    row.startVideoInterviewChatCompleted ?? false,
  startMeetingSchedulingChat: row.startMeetingSchedulingChat ?? false,
  startMeetingSchedulingChatCompleted:
    row.startMeetingSchedulingChatCompleted ?? false,
  stopChat: row.stopChat ?? false,
  lastEngagementChatControl: row.lastEngagementChatControl ?? null,
});

@RegisteredWorkspaceCommand('2.25.0', 1785600000084)
@Command({
  name: 'upgrade:2-25:fold-candidate-flags-into-json',
  description:
    'Backfill candidateFlags from legacy boolean columns, sync metadata, and drop flat candidate flag columns',
})
export class FoldCandidateFlagsIntoJsonCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
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
    const candidateTable = `${schema}."_candidate"`;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Folding candidate flag columns into candidateFlags for workspace ${workspaceId}`,
    );

    const hasLegacyStartChatColumn =
      await this.workspaceQueryService.checkIfColumnExists(
        schema,
        '_candidate',
        'startChat',
      );

    let updatedCount = 0;
    let scannedCount = 0;

    if (hasLegacyStartChatColumn) {
      const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
        `
          SELECT
            id,
            "isProfilePurchased",
            "engagementStatus",
            "startChat",
            "startChatCompleted",
            "startVideoInterviewChat",
            "startVideoInterviewChatCompleted",
            "startMeetingSchedulingChat",
            "startMeetingSchedulingChatCompleted",
            "stopChat",
            "lastEngagementChatControl",
            "candidateFlags"
          FROM ${candidateTable}
          WHERE "deletedAt" IS NULL
        `,
        [],
        workspaceId,
      )) as CandidateRow[];

      scannedCount = rows.length;

      for (const row of rows) {
        const candidateFlags = buildCandidateFlagsFromRow(row);
        const existingJson = JSON.stringify(row.candidateFlags ?? {});
        const nextJson = JSON.stringify(candidateFlags);

        if (existingJson === nextJson) {
          continue;
        }

        updatedCount += 1;

        if (isDryRun) {
          continue;
        }

        await this.workspaceQueryService.executeWorkspaceRawQuery(
          `
            UPDATE ${candidateTable}
            SET "candidateFlags" = $2::jsonb
            WHERE id = $1
          `,
          [row.id, nextJson],
          workspaceId,
        );
      }
    } else {
      this.logger.log(
        `Workspace ${workspaceId}: legacy candidate flag columns already removed; skipping backfill`,
      );
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Workspace ${workspaceId}: candidates scanned=${scannedCount}, candidateFlags backfilled=${updatedCount}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Synced Arxena standard application (candidateFlags field, legacy flag columns removed) for workspace ${workspaceId}`,
    );
  }
}
