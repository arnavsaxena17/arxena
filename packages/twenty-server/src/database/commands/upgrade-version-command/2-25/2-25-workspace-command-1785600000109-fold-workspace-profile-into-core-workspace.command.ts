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

type WorkspaceProfileRow = {
  companyName?: string | null;
  companyDomain?: string | null;
  industry?: string | null;
  summary?: string | null;
  employeeRange?: string | null;
  hq?: string | null;
  enrichmentJson?: unknown;
  icpSpec?: string | null;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000109)
@Command({
  name: 'upgrade:2-25:fold-workspace-profile-into-core-workspace',
  description:
    'Backfill company/ICP fields from CRM workspaceProfile onto core.workspace, then drop workspaceProfile',
})
export class FoldWorkspaceProfileIntoCoreWorkspaceCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Folding workspaceProfile into core.workspace for workspace ${workspaceId}`,
    );

    const profile = await this.readFirstWorkspaceProfile(schema, workspaceId);

    if (isDryRun) {
      this.logger.log(
        `Workspace ${workspaceId}: would backfill ${profile ? '1' : '0'} workspaceProfile row(s)`,
      );

      return;
    }

    if (profile) {
      await this.backfillCoreWorkspace(workspaceId, profile);
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Synced Arxena standard application (workspaceProfile removed) for workspace ${workspaceId}`,
    );
  }

  private async readFirstWorkspaceProfile(
    schema: string,
    workspaceId: string,
  ): Promise<WorkspaceProfileRow | null> {
    for (const tableName of [
      '_workspaceProfile',
      '_gtmWorkspaceProfile',
      'workspaceProfile',
      'gtmWorkspaceProfile',
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
            SELECT
              "companyName",
              "companyDomain",
              industry,
              summary,
              "employeeRange",
              hq,
              "enrichmentJson",
              "icpSpec"
            FROM ${schema}."${tableName}"
            WHERE "deletedAt" IS NULL
            ORDER BY "createdAt" ASC NULLS LAST
            LIMIT 1
          `,
          [],
          workspaceId,
        )) as WorkspaceProfileRow[];

        if (rows?.[0]) {
          return rows[0];
        }
      } catch (error) {
        this.logger.warn(
          `Could not read ${tableName} for workspace ${workspaceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return null;
  }

  private async backfillCoreWorkspace(
    workspaceId: string,
    profile: WorkspaceProfileRow,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return;
    }

    const patch: Partial<WorkspaceEntity> = {};

    const assignIfEmpty = <K extends keyof WorkspaceEntity>(
      key: K,
      value: WorkspaceEntity[K] | null | undefined,
    ) => {
      const current = workspace[key];

      if (
        (current === null || current === undefined || current === '') &&
        value !== null &&
        value !== undefined &&
        value !== ''
      ) {
        patch[key] = value as WorkspaceEntity[K];
      }
    };

    assignIfEmpty('companyName', profile.companyName ?? null);
    assignIfEmpty('companyDomain', profile.companyDomain ?? null);
    assignIfEmpty('industry', profile.industry ?? null);
    assignIfEmpty('summary', profile.summary ?? null);
    assignIfEmpty('employeeRange', profile.employeeRange ?? null);
    assignIfEmpty('hq', profile.hq ?? null);
    assignIfEmpty('icpSpec', profile.icpSpec ?? null);

    if (
      !workspace.enrichmentJson &&
      profile.enrichmentJson !== null &&
      profile.enrichmentJson !== undefined
    ) {
      patch.enrichmentJson =
        typeof profile.enrichmentJson === 'object'
          ? (profile.enrichmentJson as Record<string, unknown>)
          : { value: profile.enrichmentJson };
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    await this.workspaceRepository.update(workspaceId, patch);
  }
}
