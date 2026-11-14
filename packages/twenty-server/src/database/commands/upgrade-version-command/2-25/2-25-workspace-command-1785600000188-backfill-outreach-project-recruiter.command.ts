import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type ProjectRow = {
  id: string;
  recruiterId?: string | null;
  createdByWorkspaceMemberId?: string | null;
};

type CandidateRow = ObjectLiteral & {
  id: string;
  projectId?: string | null;
  outreachWorkspaceMemberId?: string | null;
};

// The sequencer now resolves a round's sender from project.recruiterId (Phase 1
// of the pinned-member removal). Projects created before that change have a null
// recruiter and only carry per-candidate pins, so stamp the recruiter from the
// pin those candidates share most often, falling back to the project creator.
@RegisteredWorkspaceCommand('2.25.0', 1785600000188)
@Command({
  name: 'upgrade:2-25:backfill-outreach-project-recruiter',
  description:
    'Backfill project.recruiterId from the candidate sender pins or the project creator',
})
export class BackfillOutreachProjectRecruiterCommand extends ProvisionedWorkspaceCommandRunner {
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
    const isDryRun = options.dryRun === true;
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRow>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRow>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const workspaceMemberRepository =
          await this.globalWorkspaceOrmManager.getRepository<{ id: string }>(
            workspaceId,
            'workspaceMember',
            { shouldBypassPermissionChecks: true },
          );

        const projects = await projectRepository.find();
        // Pins and creator ids can point at members deleted after the project
        // was created; writing one back would break the recruiter foreign key.
        const workspaceMembers = await workspaceMemberRepository.find({
          select: ['id'],
        });
        const existingWorkspaceMemberIds = new Set(
          workspaceMembers.map((workspaceMember) => workspaceMember.id),
        );
        let alreadySet = 0;
        let fromPin = 0;
        let fromCreator = 0;
        let unresolved = 0;

        for (const project of projects) {
          if (isNonEmptyString(project.recruiterId)) {
            alreadySet += 1;
            continue;
          }

          const candidates = await candidateRepository.find({
            where: { projectId: project.id },
            select: ['outreachWorkspaceMemberId'],
          });
          const pinnedMemberId = pickMostFrequentMemberId(
            candidates
              .map((candidate) => candidate.outreachWorkspaceMemberId?.trim())
              .filter(isNonEmptyString),
          );
          const nextRecruiterId =
            pinnedMemberId ||
            project.createdByWorkspaceMemberId?.trim() ||
            '';

          if (!isNonEmptyString(nextRecruiterId)) {
            unresolved += 1;
            continue;
          }

          if (!existingWorkspaceMemberIds.has(nextRecruiterId)) {
            unresolved += 1;
            continue;
          }

          if (isNonEmptyString(pinnedMemberId)) {
            fromPin += 1;
          } else {
            fromCreator += 1;
          }

          if (isDryRun) {
            continue;
          }

          await projectRepository.update(project.id, {
            recruiterId: nextRecruiterId,
          });
        }

        this.logger.log(
          `${isDryRun ? '[DRY RUN] ' : ''}Recruiter backfill for workspace ${workspaceId}: ${alreadySet} already set, ${fromPin} from candidate pins, ${fromCreator} from project creator, ${unresolved} without a creator`,
        );
      },
      authContext,
    );
  }
}

// Deterministic: highest count wins; a tie falls to the smallest member id so a
// rerun of the command cannot produce a different recruiter.
const pickMostFrequentMemberId = (memberIds: string[]): string => {
  const counts = new Map<string, number>();

  for (const memberId of memberIds) {
    counts.set(memberId, (counts.get(memberId) ?? 0) + 1);
  }

  let bestMemberId = '';
  let bestCount = 0;

  for (const [memberId, count] of [...counts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (count > bestCount) {
      bestMemberId = memberId;
      bestCount = count;
    }
  }

  return bestMemberId;
};
