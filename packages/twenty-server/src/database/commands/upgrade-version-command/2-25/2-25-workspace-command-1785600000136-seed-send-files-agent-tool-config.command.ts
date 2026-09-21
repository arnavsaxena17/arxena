import { Logger } from '@nestjs/common';
import { Command } from 'nest-commander';
import { InjectDataSource } from '@nestjs/typeorm';

import { type DataSource } from 'typeorm';
import { v4 } from 'uuid';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import {
  PermissionFlagType,
  SystemPermissionFlag,
} from 'twenty-shared/constants';

const LINKEDIN_SEND_FILES_TOOL_CONFIG = {
  send_files: {
    fileSource: 'sender_collateral',
    fileIds: [],
  },
};

const LINKEDIN_MESSAGE_SYSTEM_PROMPT =
  'You draft short LinkedIn messages for GTM outreach. Return JSON { "message": "<body>" } only. If the user prompt asks to share a deck or presentation, call send_files with channel linkedin after drafting (files come from sender collateral / agent config).';

@RegisteredWorkspaceCommand('2.25.0', 1785600000136)
@Command({
  name: 'upgrade:2-25:seed-send-files-agent-tool-config',
  description:
    'Ensure SEND_FILES_TOOL permission flag exists and LinkedIn outreach agents use sender_collateral send_files config',
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
    const existingFlags = (await this.dataSource.query(
      `
        SELECT id FROM core."permissionFlag"
        WHERE "workspaceId" = $1 AND key = $2
        LIMIT 1
      `,
      [workspaceId, PermissionFlagType.SEND_FILES_TOOL],
    )) as Array<{ id: string }>;

    if (!existingFlags[0]?.id) {
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

      if (applicationId) {
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
            v4(),
            PermissionFlagType.SEND_FILES_TOOL,
            'Send Files',
            'Send uploaded files via LinkedIn, email, or WhatsApp',
            'IconFileUpload',
            workspaceId,
            SystemPermissionFlag.SEND_FILES_TOOL,
            applicationId,
          ],
        );
      }
    }

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

    this.logger.log(
      `Seeded send_files toolConfigs for LinkedIn agent in workspace ${workspaceId}`,
    );
  }
}
