import { Logger } from '@nestjs/common';
import { Command } from 'nest-commander';
import { InjectDataSource } from '@nestjs/typeorm';

import { type DataSource } from 'typeorm';
import { v4 } from 'uuid';
import {
  PermissionFlagType,
  SystemPermissionFlag,
} from 'twenty-shared/constants';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { getOutreachLinkedinMessageAgentRoleIds } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

const LINKEDIN_SEND_FILES_TOOL_CONFIG = {
  send_files: {
    fileSource: 'sender_collateral',
    fileIds: [],
  },
};

const LINKEDIN_MESSAGE_SYSTEM_PROMPT =
  'You draft short LinkedIn messages for GTM outreach. Return JSON { "message": "<body>" } only. If the user prompt asks to share a deck or presentation, call send_files with channel linkedin after drafting (files come from sender collateral / agent config).';

const LINKEDIN_AGENT_ROLE_LABEL = 'GTM LinkedIn Send Files';

@RegisteredWorkspaceCommand('2.25.0', 1785600000136)
@Command({
  name: 'upgrade:2-25:seed-send-files-agent-tool-config',
  description:
    'Ensure SEND_FILES_TOOL exists, LinkedIn agent has send_files toolConfigs, and a role granting SEND_FILES_TOOL',
})
export class SeedSendFilesAgentToolConfigCommand extends ProvisionedWorkspaceCommandRunner {
  protected readonly logger = new Logger(
    SeedSendFilesAgentToolConfigCommand.name,
  );

  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
  }: RunOnWorkspaceArgs): Promise<void> {
    const applicationRows = (await this.dataSource.query(
      `
        SELECT id FROM core.application
        WHERE "workspaceId" = $1
        ORDER BY "createdAt" ASC
        LIMIT 1
      `,
      [workspaceId],
    )) as Array<{ id: string }>;

    const applicationId = applicationRows[0]?.id;

    if (!applicationId) {
      this.logger.warn(
        `No application for workspace ${workspaceId}; skip send_files seed`,
      );

      return;
    }

    let permissionFlagId = await this.ensureSendFilesPermissionFlag({
      workspaceId,
      applicationId,
    });

    await this.dataSource.query(
      `
        UPDATE core.agent
        SET "toolConfigs" = COALESCE("toolConfigs", '{}'::jsonb) || $2::jsonb,
            prompt = $3
        WHERE "workspaceId" = $1
          AND name = 'gtm-outreach-linkedin-message'
          AND "deletedAt" IS NULL
      `,
      [
        workspaceId,
        JSON.stringify(LINKEDIN_SEND_FILES_TOOL_CONFIG),
        LINKEDIN_MESSAGE_SYSTEM_PROMPT,
      ],
    );

    const agents = (await this.dataSource.query(
      `
        SELECT id FROM core.agent
        WHERE "workspaceId" = $1
          AND name = 'gtm-outreach-linkedin-message'
          AND "deletedAt" IS NULL
        LIMIT 1
      `,
      [workspaceId],
    )) as Array<{ id: string }>;

    const linkedinMessageAgentId = agents[0]?.id;

    if (!linkedinMessageAgentId || !permissionFlagId) {
      this.logger.log(
        `Seeded send_files toolConfigs for LinkedIn agent in workspace ${workspaceId} (role skipped: agent=${Boolean(linkedinMessageAgentId)} flag=${Boolean(permissionFlagId)})`,
      );

      return;
    }

    await this.ensureLinkedinAgentSendFilesRole({
      workspaceId,
      applicationId,
      linkedinMessageAgentId,
      permissionFlagId,
    });

    this.logger.log(
      `Seeded send_files toolConfigs + role for LinkedIn agent in workspace ${workspaceId}`,
    );
  }

  private async ensureSendFilesPermissionFlag({
    workspaceId,
    applicationId,
  }: {
    workspaceId: string;
    applicationId: string;
  }): Promise<string | undefined> {
    const existingFlags = (await this.dataSource.query(
      `
        SELECT id FROM core."permissionFlag"
        WHERE "workspaceId" = $1 AND key = $2
        LIMIT 1
      `,
      [workspaceId, PermissionFlagType.SEND_FILES_TOOL],
    )) as Array<{ id: string }>;

    if (existingFlags[0]?.id) {
      return existingFlags[0].id;
    }

    const permissionFlagId = v4();

    await this.dataSource.query(
      `
        INSERT INTO core."permissionFlag" (
          id, key, label, description, icon, "permissionType",
          "workspaceId", "universalIdentifier", "applicationId"
        )
        VALUES (
          $1, $2, $3, $4, $5, 'tool',
          $6, $7, $8
        )
        ON CONFLICT DO NOTHING
      `,
      [
        permissionFlagId,
        PermissionFlagType.SEND_FILES_TOOL,
        'Send Files',
        'Send uploaded files via LinkedIn, email, or WhatsApp',
        'IconFileUpload',
        workspaceId,
        SystemPermissionFlag.SEND_FILES_TOOL,
        applicationId,
      ],
    );

    const afterInsert = (await this.dataSource.query(
      `
        SELECT id FROM core."permissionFlag"
        WHERE "workspaceId" = $1 AND key = $2
        LIMIT 1
      `,
      [workspaceId, PermissionFlagType.SEND_FILES_TOOL],
    )) as Array<{ id: string }>;

    return afterInsert[0]?.id;
  }

  private async ensureLinkedinAgentSendFilesRole({
    workspaceId,
    applicationId,
    linkedinMessageAgentId,
    permissionFlagId,
  }: {
    workspaceId: string;
    applicationId: string;
    linkedinMessageAgentId: string;
    permissionFlagId: string;
  }): Promise<void> {
    const roleIds = getOutreachLinkedinMessageAgentRoleIds(workspaceId);

    const existingRoles = (await this.dataSource.query(
      `
        SELECT id FROM core.role
        WHERE "workspaceId" = $1
          AND (
            "universalIdentifier" = $2
            OR label = $3
          )
        LIMIT 1
      `,
      [workspaceId, roleIds.roleUniversalIdentifier, LINKEDIN_AGENT_ROLE_LABEL],
    )) as Array<{ id: string }>;

    const roleId = existingRoles[0]?.id ?? roleIds.roleId;

    if (existingRoles[0]?.id) {
      await this.dataSource.query(
        `
          UPDATE core.role
          SET label = $2,
              description = $3,
              "canBeAssignedToAgents" = true,
              "canBeAssignedToUsers" = false,
              "canBeAssignedToApiKeys" = false,
              "canAccessAllTools" = false,
              "canUpdateAllSettings" = false
          WHERE id = $1
        `,
        [
          roleId,
          LINKEDIN_AGENT_ROLE_LABEL,
          'Send Files for gtm-outreach-linkedin-message workflow agent',
        ],
      );
    } else {
      await this.dataSource.query(
        `
          INSERT INTO core.role (
            id, label, description, icon,
            "canUpdateAllSettings", "canAccessAllTools",
            "canReadAllObjectRecords", "canUpdateAllObjectRecords",
            "canSoftDeleteAllObjectRecords", "canDestroyAllObjectRecords",
            "isEditable", "canBeAssignedToUsers", "canBeAssignedToAgents",
            "canBeAssignedToApiKeys", "workspaceId", "universalIdentifier",
            "applicationId"
          )
          VALUES (
            $1, $2, $3, $4,
            false, false,
            false, false,
            false, false,
            true, false, true,
            false, $5, $6,
            $7
          )
        `,
        [
          roleId,
          LINKEDIN_AGENT_ROLE_LABEL,
          'Send Files for gtm-outreach-linkedin-message workflow agent',
          'IconFileUpload',
          workspaceId,
          roleIds.roleUniversalIdentifier,
          applicationId,
        ],
      );
    }

    const existingRolePermissionFlags = (await this.dataSource.query(
      `
        SELECT id FROM core."rolePermissionFlag"
        WHERE "roleId" = $1 AND "permissionFlagId" = $2
        LIMIT 1
      `,
      [roleId, permissionFlagId],
    )) as Array<{ id: string }>;

    if (!existingRolePermissionFlags[0]?.id) {
      await this.dataSource.query(
        `
          INSERT INTO core."rolePermissionFlag" (
            id, "roleId", "permissionFlagId",
            "workspaceId", "universalIdentifier", "applicationId"
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `,
        [
          roleIds.rolePermissionFlagId,
          roleId,
          permissionFlagId,
          workspaceId,
          roleIds.rolePermissionFlagUniversalIdentifier,
          applicationId,
        ],
      );
    }

    const existingRoleTargets = (await this.dataSource.query(
      `
        SELECT id FROM core."roleTarget"
        WHERE "workspaceId" = $1 AND "agentId" = $2
        LIMIT 1
      `,
      [workspaceId, linkedinMessageAgentId],
    )) as Array<{ id: string }>;

    if (existingRoleTargets[0]?.id) {
      await this.dataSource.query(
        `
          UPDATE core."roleTarget"
          SET "roleId" = $2
          WHERE id = $1
        `,
        [existingRoleTargets[0].id, roleId],
      );
    } else {
      await this.dataSource.query(
        `
          INSERT INTO core."roleTarget" (
            id, "roleId", "agentId", "userWorkspaceId", "apiKeyId",
            "workspaceId", "universalIdentifier", "applicationId"
          )
          VALUES (
            $1, $2, $3, NULL, NULL,
            $4, $5, $6
          )
        `,
        [
          roleIds.roleTargetId,
          roleId,
          linkedinMessageAgentId,
          workspaceId,
          roleIds.roleTargetUniversalIdentifier,
          applicationId,
        ],
      );
    }
  }
}
