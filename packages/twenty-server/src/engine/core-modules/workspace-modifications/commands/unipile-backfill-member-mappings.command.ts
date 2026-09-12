import { Logger } from '@nestjs/common';

import { Command, CommandRunner } from 'nest-commander';

import { WorkspaceQueryService } from '../workspace-modifications.service';

type MemberRow = {
  id: string;
  whatsappUnipileAccountId?: string | null;
  linkedinUnipileAccountId?: string | null;
};

@Command({
  name: 'unipile:backfill-member-mappings',
  description:
    'Upsert metadata.unipile_accounts from tenant workspaceMember WhatsApp/LinkedIn Unipile columns',
})
export class UnipileBackfillMemberMappingsCommand extends CommandRunner {
  private readonly logger = new Logger(
    UnipileBackfillMemberMappingsCommand.name,
  );

  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {
    super();
  }

  async run(): Promise<void> {
    let whatsappUpserts = 0;
    let linkedinUpserts = 0;

    const workspaceIds = await this.workspaceQueryService.getWorkspaces();

    for (const workspaceId of workspaceIds) {
      const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
      const memberTable =
        await this.workspaceQueryService.resolveWorkspaceMemberTableName(
          schema,
        );

      if (!memberTable) {
        continue;
      }

      const hasWa = await this.workspaceQueryService.checkIfColumnExists(
        schema,
        memberTable,
        'whatsappUnipileAccountId',
        { silent: true },
      );
      const hasLi = await this.workspaceQueryService.checkIfColumnExists(
        schema,
        memberTable,
        'linkedinUnipileAccountId',
        { silent: true },
      );

      if (!hasWa && !hasLi) {
        continue;
      }

      const selectParts = ['"id"'];
      if (hasWa) {
        selectParts.push('"whatsappUnipileAccountId"');
      }
      if (hasLi) {
        selectParts.push('"linkedinUnipileAccountId"');
      }

      const whereParts: string[] = [];
      if (hasWa) {
        whereParts.push(
          `("whatsappUnipileAccountId" IS NOT NULL AND btrim("whatsappUnipileAccountId") <> '')`,
        );
      }
      if (hasLi) {
        whereParts.push(
          `("linkedinUnipileAccountId" IS NOT NULL AND btrim("linkedinUnipileAccountId") <> '')`,
        );
      }

      const query = `SELECT ${selectParts.join(', ')} FROM ${schema}."${memberTable}" WHERE ${whereParts.join(' OR ')}`;

      let rows: MemberRow[];

      try {
        rows = await this.workspaceQueryService.executeWorkspaceRawQuery(
          query,
          [],
          workspaceId,
        );
      } catch (err) {
        this.logger.warn(
          `Skipping workspace ${workspaceId} (${schema}): ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      for (const row of rows ?? []) {
        const memberId = row.id;
        if (!memberId) {
          continue;
        }

        if (hasWa && row.whatsappUnipileAccountId?.trim()) {
          await this.workspaceQueryService.upsertUnipileMemberAccountMapping(
            memberId,
            workspaceId,
            row.whatsappUnipileAccountId.trim(),
            'WHATSAPP',
          );
          whatsappUpserts++;
        }
        if (hasLi && row.linkedinUnipileAccountId?.trim()) {
          await this.workspaceQueryService.upsertUnipileMemberAccountMapping(
            memberId,
            workspaceId,
            row.linkedinUnipileAccountId.trim(),
            'LINKEDIN',
          );
          linkedinUpserts++;
        }
      }
    }

    this.logger.log(
      `Done. Upserts — WhatsApp: ${whatsappUpserts}, LinkedIn: ${linkedinUpserts}`,
    );
  }
}
