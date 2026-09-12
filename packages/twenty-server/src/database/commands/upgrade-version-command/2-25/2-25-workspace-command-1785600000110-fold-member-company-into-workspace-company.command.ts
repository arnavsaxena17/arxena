import { InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { type Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type MemberCompanyRow = {
  companyName?: string | null;
  companyDescription?: string | null;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000110)
@Command({
  name: 'upgrade:2-25:fold-member-company-into-workspace-company',
  description:
    'Backfill core.workspace companyName/summary from workspaceMember seat company fields, then drop those member fields',
})
export class FoldMemberCompanyIntoWorkspaceCompanyCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Folding member company fields into core.workspace for workspace ${workspaceId}`,
    );

    const fromMember = await this.readFirstMemberCompany(schema, workspaceId);
    const fromProfile = await this.readFirstProfileCompany(schema, workspaceId);
    const companyName =
      trimOrNull(fromMember?.companyName) ??
      trimOrNull(fromProfile?.companyName);
    const companyDescription =
      trimOrNull(fromMember?.companyDescription) ??
      trimOrNull(fromProfile?.companyDescription);

    if (isDryRun) {
      this.logger.log(
        `Workspace ${workspaceId}: would backfill companyName=${Boolean(companyName)} summary=${Boolean(companyDescription)}`,
      );

      return;
    }

    await this.backfillCoreWorkspace(workspaceId, {
      companyName,
      summary: companyDescription,
    });

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Synced Arxena standard application (member companyName/companyDescription removed) for workspace ${workspaceId}`,
    );
  }

  private async readFirstMemberCompany(
    schema: string,
    workspaceId: string,
  ): Promise<MemberCompanyRow | null> {
    for (const tableName of ['_workspaceMember', 'workspaceMember']) {
      const exists = await this.workspaceQueryService.checkIfTableExists(
        schema,
        tableName,
      );

      if (!exists) {
        continue;
      }

      const hasCompanyName =
        await this.workspaceQueryService.checkIfColumnExists(
          schema,
          tableName,
          'companyName',
          { silent: true },
        );
      const hasCompanyDescription =
        await this.workspaceQueryService.checkIfColumnExists(
          schema,
          tableName,
          'companyDescription',
          { silent: true },
        );

      if (!hasCompanyName && !hasCompanyDescription) {
        continue;
      }

      const selectParts = [
        hasCompanyName ? `"companyName"` : `NULL AS "companyName"`,
        hasCompanyDescription
          ? `"companyDescription"`
          : `NULL AS "companyDescription"`,
      ];

      try {
        const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
          `
            SELECT ${selectParts.join(', ')}
            FROM ${schema}."${tableName}"
            WHERE "deletedAt" IS NULL
              AND (
                ${hasCompanyName ? `("companyName" IS NOT NULL AND "companyName" <> '')` : 'FALSE'}
                OR
                ${hasCompanyDescription ? `("companyDescription" IS NOT NULL AND "companyDescription" <> '')` : 'FALSE'}
              )
            ORDER BY "createdAt" ASC NULLS LAST
            LIMIT 1
          `,
          [],
          workspaceId,
        )) as MemberCompanyRow[];

        if (rows?.[0]) {
          return rows[0];
        }
      } catch (error) {
        this.logger.warn(
          `Could not read ${tableName} company fields for workspace ${workspaceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return null;
  }

  private async readFirstProfileCompany(
    schema: string,
    workspaceId: string,
  ): Promise<MemberCompanyRow | null> {
    for (const tableName of [
      '_workspaceMemberProfile',
      'workspaceMemberProfile',
    ]) {
      const exists = await this.workspaceQueryService.checkIfTableExists(
        schema,
        tableName,
      );

      if (!exists) {
        continue;
      }

      try {
        const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
          `
            SELECT "companyName", "companyDescription"
            FROM ${schema}."${tableName}"
            WHERE "deletedAt" IS NULL
              AND (
                ("companyName" IS NOT NULL AND "companyName" <> '')
                OR ("companyDescription" IS NOT NULL AND "companyDescription" <> '')
              )
            ORDER BY "createdAt" ASC NULLS LAST
            LIMIT 1
          `,
          [],
          workspaceId,
        )) as MemberCompanyRow[];

        if (rows?.[0]) {
          return rows[0];
        }
      } catch (error) {
        this.logger.warn(
          `Could not read ${tableName} company fields for workspace ${workspaceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return null;
  }

  private async backfillCoreWorkspace(
    workspaceId: string,
    input: { companyName: string | null; summary: string | null },
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return;
    }

    const patch: Partial<WorkspaceEntity> = {};

    if (
      isEmptyString(workspace.companyName) &&
      !isEmptyString(input.companyName)
    ) {
      patch.companyName = input.companyName;
    }

    if (isEmptyString(workspace.summary) && !isEmptyString(input.summary)) {
      patch.summary = input.summary;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    await this.workspaceRepository.update(workspaceId, patch);
  }
}

const trimOrNull = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();

  return trimmed.length > 0 ? trimmed : null;
};

const isEmptyString = (value: string | null | undefined): boolean =>
  value == null || String(value).trim() === '';
