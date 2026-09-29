import { Command } from 'nest-commander';
import { type ObjectLiteral } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import {
  patchCalendarSlotMinutesOnRunState,
  patchCalendarSlotMinutesOnSteps,
} from 'src/database/commands/upgrade-version-command/2-25/utils/patch-calendar-slot-minutes.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkflowVersionRecord = ObjectLiteral & {
  id: string;
  steps: unknown;
};

type WorkflowRunRecord = ObjectLiteral & {
  id: string;
  state: unknown;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000146)
@Command({
  name: 'upgrade:2-25:set-outreach-calendar-slots-to-thirty-minutes',
  description:
    'Set get-calendar-availability slotMinutes from 20 to 30 on stored workflow versions',
})
export class SetOutreachCalendarSlotsToThirtyMinutesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowVersionRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionRecord>(
          workspaceId,
          'workflowVersion',
          { shouldBypassPermissionChecks: true },
        );
      const versions = await workflowVersionRepository.find();
      let patched = 0;

      for (const version of versions) {
        const stepsResult = patchCalendarSlotMinutesOnSteps(version.steps);

        if (!stepsResult.changed) {
          continue;
        }

        patched += 1;

        if (isDryRun) {
          continue;
        }

        await workflowVersionRepository.update(version.id, {
          steps: stepsResult.next,
        } as QueryDeepPartialEntity<WorkflowVersionRecord>);
      }

      const workflowRunRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowRunRecord>(
          workspaceId,
          'workflowRun',
          { shouldBypassPermissionChecks: true },
        );
      const workflowRuns = await workflowRunRepository.find();
      let patchedRuns = 0;

      for (const workflowRun of workflowRuns) {
        const stateResult = patchCalendarSlotMinutesOnRunState(
          workflowRun.state,
        );

        if (!stateResult.changed) {
          continue;
        }

        patchedRuns += 1;

        if (isDryRun) {
          continue;
        }

        await workflowRunRepository.update(workflowRun.id, {
          state: stateResult.next,
        } as QueryDeepPartialEntity<WorkflowRunRecord>);
      }

      const prefix = isDryRun ? '[DRY RUN] ' : '';

      this.logger.log(
        `${prefix}Patched calendar slotMinutes 20 → 30 on ${patched} workflowVersion(s) and ${patchedRuns} workflowRun(s) for workspace ${workspaceId}`,
      );
    }, authContext);
  }
}
