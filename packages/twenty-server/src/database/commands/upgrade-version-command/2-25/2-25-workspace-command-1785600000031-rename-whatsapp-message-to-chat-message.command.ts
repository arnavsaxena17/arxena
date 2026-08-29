import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const SKILL_UNIVERSAL_IDENTIFIERS_TO_SYNC = [
  STANDARD_SKILL.outreach.universalIdentifier,
] as const;

type WorkflowVersionRecord = ObjectLiteral & {
  id: string;
  steps: unknown;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000031)
@Command({
  name: 'upgrade:2-25:rename-whatsapp-message-to-chat-message',
  description:
    'Rename whatsappMessage → chatMessage, drop textMessage, patch workflow FIND_RECORDS, refresh gtm-outreach-workflows skill',
})
export class RenameWhatsappMessageToChatMessageCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Renaming whatsappMessage → chatMessage for workspace ${workspaceId}`,
    );

    if (!isDryRun) {
      await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
        { workspaceId },
      );

      this.logger.log(
        `Synced Arxena standard application (chatMessage rename, textMessage delete) for workspace ${workspaceId}`,
      );

      await this.ensureChatMessageIndexes(workspaceId);
    }

    await this.patchWorkflowObjectNames({ workspaceId, isDryRun });
    await this.syncOutreachWorkflowsSkill({ workspaceId, isDryRun });
  }

  private async ensureChatMessageIndexes(workspaceId: string): Promise<void> {
    const schema = getWorkspaceSchemaName(workspaceId);
    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_chat_message_created_at ON "${schema}"."_chatMessage" ("createdAt")`,
      `CREATE INDEX IF NOT EXISTS idx_chat_message_delivery_status ON "${schema}"."_chatMessage" ("whatsappDeliveryStatus")`,
      `CREATE INDEX IF NOT EXISTS idx_chat_message_recruiter ON "${schema}"."_chatMessage" ("recruiterId")`,
      `CREATE INDEX IF NOT EXISTS idx_chat_message_project ON "${schema}"."_chatMessage" ("projectsId")`,
    ];
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const dataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSource();

        for (const query of indexQueries) {
          try {
            await dataSource.query(query, [], undefined, {
              shouldBypassPermissionChecks: true,
            });
          } catch (error) {
            this.logger.warn(
              `Skipping chatMessage index for workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
      authContext,
    );
  }

  private rewriteWhatsappMessageObjectNames(value: unknown): {
    next: unknown;
    changed: boolean;
  } {
    const serialized = JSON.stringify(value);

    if (
      !serialized.includes('"whatsappMessage"') &&
      !serialized.includes('"whatsappMessages"')
    ) {
      return { next: value, changed: false };
    }

    const rewritten = serialized
      .replaceAll('"objectName":"whatsappMessage"', '"objectName":"chatMessage"')
      .replaceAll(
        '"objectName": "whatsappMessage"',
        '"objectName": "chatMessage"',
      )
      .replaceAll('"whatsappMessages"', '"chatMessages"');

    return { next: JSON.parse(rewritten), changed: rewritten !== serialized };
  }

  private async patchWorkflowObjectNames({
    workspaceId,
    isDryRun,
  }: {
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowVersionRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionRecord>(
            workspaceId,
            'workflowVersion',
            { shouldBypassPermissionChecks: true },
          );
        const versions = await workflowVersionRepository.find();
        let patched = 0;

        for (const version of versions) {
          const { next, changed } = this.rewriteWhatsappMessageObjectNames(
            version.steps,
          );

          if (!changed) {
            continue;
          }

          patched += 1;

          if (isDryRun) {
            continue;
          }

          await workflowVersionRepository.update(version.id, { steps: next });
        }

        this.logger.log(
          `${isDryRun ? '[DRY RUN] ' : ''}Patched ${patched} workflowVersion(s) objectName whatsappMessage → chatMessage for workspace ${workspaceId}`,
        );
      },
      authContext,
    );
  }

  private async syncOutreachWorkflowsSkill({
    workspaceId,
    isDryRun,
  }: {
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<void> {
    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatSkillMaps: existingFlatSkillMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatSkillMaps',
      ]);

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const skillsToCreate = [];
    const skillsToUpdate = [];

    for (const universalIdentifier of SKILL_UNIVERSAL_IDENTIFIERS_TO_SYNC) {
      const standardSkill =
        standardAllFlatEntityMaps.flatSkillMaps.byUniversalIdentifier[
          universalIdentifier
        ];

      if (!isDefined(standardSkill)) {
        continue;
      }

      const existingSkill =
        existingFlatSkillMaps.byUniversalIdentifier[universalIdentifier];

      if (!isDefined(existingSkill)) {
        skillsToCreate.push(standardSkill);
        continue;
      }

      if (
        existingSkill.content === standardSkill.content &&
        existingSkill.description === standardSkill.description &&
        existingSkill.label === standardSkill.label
      ) {
        continue;
      }

      skillsToUpdate.push({
        ...existingSkill,
        content: standardSkill.content,
        description: standardSkill.description,
        label: standardSkill.label,
      });
    }

    if (skillsToCreate.length === 0 && skillsToUpdate.length === 0) {
      this.logger.log(
        `gtm-outreach-workflows skill already up to date for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `Workspace ${workspaceId}: create=${skillsToCreate.map((skill) => skill.name).join(',') || 'none'} update=${skillsToUpdate.map((skill) => skill.name).join(',') || 'none'}`,
    );

    if (isDryRun) {
      return;
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            skill: {
              flatEntityToCreate: skillsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: skillsToUpdate,
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      this.logger.error(
        `Failed to sync gtm-outreach-workflows skill after chatMessage rename:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to sync gtm-outreach-workflows skill for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Synced gtm-outreach-workflows skill after chatMessage rename for workspace ${workspaceId}`,
    );
  }
}
