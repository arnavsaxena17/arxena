import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { Command, CommandRunner, Option } from 'nest-commander';
import { DataSource } from 'typeorm';

import { WorkspaceQueryService } from '../workspace-modifications.service';

type MappingAccount = {
  oldId: string;
  newId: string;
  provider?: string;
};

type MappingFile = {
  accounts?: MappingAccount[];
};

type RemapOptions = {
  file?: string;
  dryRun?: boolean;
};

@Command({
  name: 'unipile:remap-v2-account-ids',
  description:
    'Rewrite stored Unipile v1 account IDs to v2 acc_ IDs using a mapping JSON file',
})
export class UnipileRemapV2AccountIdsCommand extends CommandRunner {
  private readonly logger = new Logger(UnipileRemapV2AccountIdsCommand.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    @InjectDataSource()
    private readonly metadataDataSource: DataSource,
  ) {
    super();
  }

  @Option({
    flags: '-f, --file [path]',
    description:
      'Path to mapping JSON ({ accounts: [{ oldId, newId, provider }] }). Defaults to UNIPILE_V2_ACCOUNT_ID_MAPPING_PATH',
    required: false,
  })
  parseFile(val?: string): string | undefined {
    return val;
  }

  @Option({
    flags: '--dry-run',
    description: 'Log updates without writing',
    required: false,
  })
  parseDryRun(): boolean {
    return true;
  }

  async run(
    _passedParams: string[],
    options: RemapOptions,
  ): Promise<void> {
    const filePath = resolve(
      options.file ||
        process.env.UNIPILE_V2_ACCOUNT_ID_MAPPING_PATH ||
        'unipile-v2-account-id-mapping.json',
    );

    if (!existsSync(filePath)) {
      throw new Error(
        `Mapping file not found: ${filePath}. Copy unipile-v2-account-id-mapping.example.json after the dashboard transfer.`,
      );
    }

    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as MappingFile;
    const accounts = (parsed.accounts ?? []).filter(
      (row) => row.oldId?.trim() && row.newId?.trim(),
    );

    if (accounts.length === 0) {
      throw new Error(`No accounts found in ${filePath}`);
    }

    const dryRun = Boolean(options.dryRun);
    let profileUpdates = 0;
    let mappingUpdates = 0;
    let workspaceUpdates = 0;

    for (const account of accounts) {
      const oldId = account.oldId.trim();
      const newId = account.newId.trim();
      if (oldId === newId) {
        continue;
      }

      this.logger.log(
        `${dryRun ? '[dry-run] ' : ''}Remap ${oldId} → ${newId} (${account.provider ?? 'unknown'})`,
      );

      if (!dryRun) {
        const mappingResult = await this.metadataDataSource.query(
          `UPDATE metadata.unipile_accounts SET account_id = $1 WHERE account_id = $2`,
          [newId, oldId],
        );
        mappingUpdates += Number(mappingResult?.[1] ?? 0);

        const liWorkspace = await this.metadataDataSource.query(
          `UPDATE core.workspace SET linkedin_unipile_account_id = $1 WHERE linkedin_unipile_account_id = $2`,
          [newId, oldId],
        );
        const waWorkspace = await this.metadataDataSource.query(
          `UPDATE core.workspace SET whatsapp_unipile_account_id = $1 WHERE whatsapp_unipile_account_id = $2`,
          [newId, oldId],
        );
        workspaceUpdates +=
          Number(liWorkspace?.[1] ?? 0) + Number(waWorkspace?.[1] ?? 0);
      }

      const workspaceIds = await this.workspaceQueryService.getWorkspaces();
      for (const workspaceId of workspaceIds) {
        const schema =
          this.workspaceQueryService.getDataSourceSchema(workspaceId);
        const profileTable =
          await this.workspaceQueryService.resolveWorkspaceMemberProfileTableName(
            schema,
          );
        if (!profileTable) {
          continue;
        }

        for (const columnName of [
          'linkedinUnipileAccountId',
          'whatsappUnipileAccountId',
        ] as const) {
          const exists = await this.workspaceQueryService.checkIfColumnExists(
            schema,
            profileTable,
            columnName,
            { silent: true },
          );
          if (!exists) {
            continue;
          }

          if (dryRun) {
            const rows = await this.workspaceQueryService.executeWorkspaceRawQuery<
              Array<{ count: string }>
            >(
              `SELECT COUNT(*)::text AS count FROM ${schema}."${profileTable}" WHERE "${columnName}" = $1`,
              [oldId],
              workspaceId,
            );
            profileUpdates += Number(rows?.[0]?.count ?? 0);
            continue;
          }

          await this.workspaceQueryService.executeWorkspaceRawQuery(
            `UPDATE ${schema}."${profileTable}" SET "${columnName}" = $1 WHERE "${columnName}" = $2`,
            [newId, oldId],
            workspaceId,
          );
          profileUpdates += 1;
        }

        await this.preferProviderIdsOnChatMessages(
          schema,
          workspaceId,
          dryRun,
        );
      }
    }

    this.logger.log(
      `Done. Profile column writes: ${profileUpdates}, metadata.unipile_accounts rows touched: ${mappingUpdates}, core.workspace rows touched: ${workspaceUpdates}`,
    );
    this.logger.log(
      'Also update env UNIPILE_LINKEDIN_ACCOUNT_ID / UNIPILE_WHATSAPP_ACCOUNT_ID / WORKFLOW_APPROVAL_WHATSAPP_UNIPILE_ACCOUNT_ID / UNIPILE_DISCONNECT_EXCLUDED_ACCOUNT_IDS, then point UNIPILE_API_URL at https://api.unipile.com and disable v1 webhooks in the Unipile dashboard.',
    );
  }

  private async preferProviderIdsOnChatMessages(
    schema: string,
    workspaceId: string,
    dryRun: boolean,
  ): Promise<void> {
    const tableName = await this.resolveChatMessageTable(schema);
    if (!tableName) {
      return;
    }

    const hasExternal = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      tableName,
      'externalMessageId',
      { silent: true },
    );
    const hasProvider = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      tableName,
      'providerMessageId',
      { silent: true },
    );
    if (!hasExternal || !hasProvider) {
      return;
    }

    if (dryRun) {
      return;
    }

    await this.workspaceQueryService.executeWorkspaceRawQuery(
      `UPDATE ${schema}."${tableName}"
       SET "externalMessageId" = "providerMessageId"
       WHERE "providerMessageId" IS NOT NULL
         AND btrim("providerMessageId") <> ''
         AND (
           "externalMessageId" IS NULL
           OR btrim("externalMessageId") = ''
           OR "externalMessageId" <> "providerMessageId"
         )`,
      [],
      workspaceId,
    );
  }

  private async resolveChatMessageTable(schema: string): Promise<string | null> {
    if (await this.workspaceQueryService.checkIfTableExists(schema, '_chatMessage')) {
      return '_chatMessage';
    }
    if (await this.workspaceQueryService.checkIfTableExists(schema, 'chatMessage')) {
      return 'chatMessage';
    }
    return null;
  }
}
