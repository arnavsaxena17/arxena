import { Command } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral, type Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { flattenFatOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/flatten-fat-outreach-sender-profile.util';
import { normalizeOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/outreach-sender-profile.util';
import { parseIcpSpec } from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberSenderRow = ObjectLiteral & {
  id: string;
  outreachSenderProfile?: unknown;
};

// Upgrade-only: rewrite stored slim `prose` key to `brief` before normalize.
const withBriefInsteadOfProse = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const record = { ...(value as Record<string, unknown>) };

  if (
    typeof record.prose === 'string' &&
    !(typeof record.brief === 'string' && isNonEmptyString(record.brief.trim()))
  ) {
    record.brief = record.prose;
  }

  delete record.prose;

  return record;
};

// Fold fat nested sender profiles (+ workspace icpSpec) into slim
// { targetTitles, locations, brief } on each workspace member.
@RegisteredWorkspaceCommand('2.25.0', 1785600000134)
@Command({
  name: 'upgrade:2-25:slim-outreach-sender-profile',
  description:
    'Flatten outreachSenderProfile to targetTitles/locations/brief; seed from workspace icpSpec when empty',
})
export class SlimOutreachSenderProfileCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Slimming outreach sender profiles for workspace ${workspaceId}`,
    );

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });
    const workspaceIcp = parseIcpSpec(workspace?.icpSpec ?? null);
    const workspaceBriefParts = [
      isNonEmptyString(workspace?.summary?.trim())
        ? `Offer: ${workspace!.summary!.trim()}`
        : '',
      isNonEmptyString(workspace?.industry?.trim())
        ? `Industry: ${workspace!.industry!.trim()}`
        : '',
    ].filter(isNonEmptyString);
    const workspaceBrief = workspaceBriefParts.join('\n');

    let updatedMembers = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const memberRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberSenderRow>(
          workspaceId,
          'workspaceMember',
          { shouldBypassPermissionChecks: true },
        );

      const members = await memberRepository.find({ take: 5_000 });

      for (const member of members) {
        const raw = member.outreachSenderProfile;
        const hasFatShape =
          isDefined(raw) &&
          typeof raw === 'object' &&
          !Array.isArray(raw) &&
          ('identity' in (raw as object) ||
            'offer' in (raw as object) ||
            'icp' in (raw as object));

        let next = hasFatShape
          ? flattenFatOutreachSenderProfile(raw)
          : normalizeOutreachSenderProfile(withBriefInsteadOfProse(raw));

        if (
          next.targetTitles.length === 0 &&
          workspaceIcp.targetTitles.length > 0
        ) {
          next = { ...next, targetTitles: workspaceIcp.targetTitles };
        }

        if (next.locations.length === 0 && workspaceIcp.locations.length > 0) {
          next = { ...next, locations: workspaceIcp.locations };
        }

        if (!isNonEmptyString(next.brief) && isNonEmptyString(workspaceBrief)) {
          next = { ...next, brief: workspaceBrief };
        }

        const previousJson = JSON.stringify(raw ?? null);
        const nextJson = JSON.stringify(next);

        if (previousJson === nextJson) {
          continue;
        }

        updatedMembers += 1;

        if (!isDryRun) {
          await memberRepository.update(
            { id: member.id },
            { outreachSenderProfile: next },
          );
        }
      }
    }, buildSystemAuthContext(workspaceId));

    this.logger.log(
      `${isDryRun ? '[DRY RUN] Would update' : 'Updated'} ${updatedMembers} workspace member sender profile(s)`,
    );
  }
}
