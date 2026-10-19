import { Command } from 'nest-commander';

import { isNonEmptyString } from '@sniptt/guards';
import {
  OUTREACH_DRAFT_DEFAULT_TEMPLATES,
  OUTREACH_DRAFT_TEMPLATE_FIELD_NAMES,
  OUTREACH_DRAFT_TEMPLATE_KEYS,
} from 'twenty-shared/arx';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';

type WorkspaceMemberDraftRow = ObjectLiteral & { id: string };

// Adds the standard draft message fields on workspace members, seeds the
// render-outreach-draft-template logic function and fills empty templates with
// the defaults. The sequencer graph is untouched: workspaces opt in through
// Setup → Draft messages → Manual (or Edit Workflow).
@RegisteredWorkspaceCommand('2.25.0', 1785600000183)
@Command({
  name: 'upgrade:2-25:add-outreach-draft-templates',
  description:
    'Add workspace member draft template fields, seed the render-outreach-draft-template logic function and default templates',
})
export class AddOutreachDraftTemplatesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding outreach draft templates for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.prefillLogicFunctionService.ensureSeeded({
      workspaceId,
      definitions: getOutreachLogicFunctionDefinitions(workspaceId),
    });

    let seededMembers = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const memberRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberDraftRow>(
          workspaceId,
          'workspaceMember',
          { shouldBypassPermissionChecks: true },
        );
      const members = await memberRepository.find({ take: 5_000 });

      for (const member of members) {
        const missingDefaults: Record<string, string> = {};

        for (const key of OUTREACH_DRAFT_TEMPLATE_KEYS) {
          const fieldName = OUTREACH_DRAFT_TEMPLATE_FIELD_NAMES[key];

          if (!isNonEmptyString(member[fieldName])) {
            missingDefaults[fieldName] = OUTREACH_DRAFT_DEFAULT_TEMPLATES[key];
          }
        }

        if (Object.keys(missingDefaults).length === 0) {
          continue;
        }

        seededMembers += 1;
        await memberRepository.update(
          { id: member.id },
          missingDefaults as never,
        );
      }
    }, buildSystemAuthContext(workspaceId));

    this.logger.log(
      `Outreach draft templates ready for workspace ${workspaceId} (${seededMembers} member(s) seeded)`,
    );
  }
}
