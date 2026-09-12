import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource, type Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

// Graphs that FIND_RECORDS the former workspaceMemberProfile object for sender JSON.
const GRAPHS_WITH_MEMBER_PROFILE_LOAD = [
  SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
  SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
  SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
] as const;

type ProfileRow = {
  id: string;
  workspaceMemberId: string | null;
  typeWorkspaceMember?: string | null;
  linkedinUrl?: string | null;
  phoneNumber?: string | null;
  companyName?: string | null;
  companyDescription?: string | null;
  linkedinUnipileAccountId?: string | null;
  linkedinLiAtToken?: string | null;
  linkedinCookiesLastSyncedAt?: string | null;
  chromeExtensionId?: string | null;
  linkedinLiAToken?: string | null;
  linkedinUserAgent?: string | null;
  linkedinIp?: string | null;
  linkedinCountry?: string | null;
  linkedinCookiesValidatedAt?: string | null;
  whatsappUnipileAccountId?: string | null;
  keepLinkedinConnected?: boolean | null;
  linkedinProfile?: unknown;
  outreachSenderProfile?: unknown;
  lastLinkedinConnectAt?: string | null;
  lastLinkedinMessageAt?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
};

const ARX_COPY_COLUMNS = [
  'typeWorkspaceMember',
  'linkedinUrl',
  'phoneNumber',
  'linkedinUnipileAccountId',
  'linkedinLiAtToken',
  'linkedinCookiesLastSyncedAt',
  'chromeExtensionId',
  'linkedinLiAToken',
  'linkedinUserAgent',
  'linkedinIp',
  'linkedinCountry',
  'linkedinCookiesValidatedAt',
  'whatsappUnipileAccountId',
  'keepLinkedinConnected',
  'linkedinProfile',
  'outreachSenderProfile',
  'lastLinkedinConnectAt',
  'lastLinkedinMessageAt',
] as const;

@RegisteredWorkspaceCommand('2.25.0', 1785600000107)
@Command({
  name: 'upgrade:2-25:fold-workspace-member-profile-into-member',
  description:
    'Copy workspaceMemberProfile rows onto workspaceMember, rempoint orgChart.createdByProfile to recruiter, drop the profile object, and resync sequencer graphs that loaded it',
})
export class FoldWorkspaceMemberProfileIntoMemberCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Folding workspaceMemberProfile into workspaceMember for workspace ${workspaceId}`,
    );

    const profileRows = await this.readProfileRows(schema, workspaceId);
    const orgChartRempoints = await this.readOrgChartRempoints(
      schema,
      workspaceId,
      profileRows,
    );

    this.logger.log(
      `Workspace ${workspaceId}: loaded ${profileRows.length} workspaceMemberProfile row(s), ${orgChartRempoints.length} orgChart rempoint(s)`,
    );

    if (isDryRun) {
      return;
    }

    // Company name/description live on core.workspace (company profile), not seat
    await this.backfillWorkspaceCompanyFromProfiles(workspaceId, profileRows);

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    let copiedCount = 0;

    for (const profile of profileRows) {
      if (!profile.workspaceMemberId) {
        continue;
      }

      const didCopy = await this.copyProfileOntoMember(
        schema,
        workspaceId,
        profile,
      );

      if (didCopy) {
        copiedCount += 1;
      }
    }

    const rempointed = await this.applyOrgChartRempoints(
      schema,
      workspaceId,
      orgChartRempoints,
    );

    await this.resyncSequencerGraphsAfterProfileFold(workspaceId);

    this.logger.log(
      `Workspace ${workspaceId}: copied ${copiedCount} profile(s), rempointed ${rempointed} orgChart(s)`,
    );
  }

  // Seeded FIND_RECORDS still pointed at workspaceMemberProfile; rewrite to member.
  private async resyncSequencerGraphsAfterProfileFold(
    workspaceId: string,
  ): Promise<void> {
    const schemaName = getWorkspaceSchemaName(workspaceId);
    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      await prefillOutreachWorkflows({
        entityManager: queryRunner.manager,
        workspaceId,
        schemaName,
        applicationId: workspaceCustomFlatApplication.id,
        replaceExistingDrafts: true,
        onlyGraphNames: GRAPHS_WITH_MEMBER_PROFILE_LOAD,
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatAgentMaps',
      'workflowAutomatedTriggerMaps',
    ]);

    this.logger.log(
      `Resynced sequencer graphs onto workspaceMember after profile fold for workspace ${workspaceId}`,
    );
  }

  private async readProfileRows(
    schema: string,
    workspaceId: string,
  ): Promise<ProfileRow[]> {
    const profileTable = await this.resolveProfileTableName(schema);

    if (!profileTable) {
      return [];
    }

    const selectColumns = [
      'id',
      '"workspaceMemberId"',
      ...ARX_COPY_COLUMNS.map((column) => `"${column}"`),
      '"firstName"',
      '"lastName"',
      '"email"',
      '"jobTitle"',
    ].join(', ');

    try {
      return (await this.workspaceQueryService.executeWorkspaceRawQuery(
        `
          SELECT ${selectColumns}
          FROM ${schema}."${profileTable}"
          WHERE "deletedAt" IS NULL
        `,
        [],
        workspaceId,
      )) as ProfileRow[];
    } catch (error) {
      this.logger.warn(
        `Could not read ${profileTable} for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return [];
    }
  }

  private async resolveProfileTableName(
    schema: string,
  ): Promise<'_workspaceMemberProfile' | 'workspaceMemberProfile' | null> {
    if (
      await this.workspaceQueryService.checkIfTableExists(
        schema,
        '_workspaceMemberProfile',
      )
    ) {
      return '_workspaceMemberProfile';
    }

    if (
      await this.workspaceQueryService.checkIfTableExists(
        schema,
        'workspaceMemberProfile',
      )
    ) {
      return 'workspaceMemberProfile';
    }

    return null;
  }

  private async resolveMemberTableName(
    schema: string,
  ): Promise<'_workspaceMember' | 'workspaceMember' | null> {
    if (
      await this.workspaceQueryService.checkIfTableExists(
        schema,
        '_workspaceMember',
      )
    ) {
      return '_workspaceMember';
    }

    if (
      await this.workspaceQueryService.checkIfTableExists(
        schema,
        'workspaceMember',
      )
    ) {
      return 'workspaceMember';
    }

    return null;
  }

  private async resolveOrgChartTableName(
    schema: string,
  ): Promise<'_orgChart' | 'orgChart' | null> {
    if (
      await this.workspaceQueryService.checkIfTableExists(schema, '_orgChart')
    ) {
      return '_orgChart';
    }

    if (
      await this.workspaceQueryService.checkIfTableExists(schema, 'orgChart')
    ) {
      return 'orgChart';
    }

    return null;
  }

  private async copyProfileOntoMember(
    schema: string,
    workspaceId: string,
    profile: ProfileRow,
  ): Promise<boolean> {
    const memberTableName = await this.resolveMemberTableName(schema);

    if (!memberTableName) {
      this.logger.warn(
        `No workspaceMember table found in schema ${schema}; skipping profile ${profile.id}`,
      );

      return false;
    }

    const memberTable = `${schema}."${memberTableName}"`;
    const setClauses: string[] = [];
    const params: unknown[] = [profile.workspaceMemberId];

    for (const column of ARX_COPY_COLUMNS) {
      const value = profile[column];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      const columnExists = await this.workspaceQueryService.checkIfColumnExists(
        schema,
        memberTableName,
        column,
        { silent: true },
      );

      if (!columnExists) {
        continue;
      }

      params.push(
        column === 'linkedinProfile' || column === 'outreachSenderProfile'
          ? JSON.stringify(value)
          : value,
      );

      const paramIndex = params.length;
      const cast =
        column === 'linkedinProfile' || column === 'outreachSenderProfile'
          ? '::jsonb'
          : '';

      setClauses.push(
        `"${column}" = COALESCE("${column}", $${paramIndex}${cast})`,
      );
    }

    // Identity overlaps: only fill when member value empty
    if (profile.email) {
      params.push(profile.email);
      setClauses.push(
        `"userEmail" = CASE WHEN "userEmail" IS NULL OR "userEmail" = '' THEN $${params.length} ELSE "userEmail" END`,
      );
    }

    if (profile.jobTitle) {
      params.push(profile.jobTitle);
      setClauses.push(
        `"jobTitle" = CASE WHEN "jobTitle" IS NULL OR "jobTitle" = '' THEN $${params.length} ELSE "jobTitle" END`,
      );
    }

    if (profile.firstName || profile.lastName) {
      if (profile.firstName) {
        params.push(profile.firstName);
        setClauses.push(
          `"nameFirstName" = CASE WHEN "nameFirstName" IS NULL OR "nameFirstName" = '' THEN $${params.length} ELSE "nameFirstName" END`,
        );
      }

      if (profile.lastName) {
        params.push(profile.lastName);
        setClauses.push(
          `"nameLastName" = CASE WHEN "nameLastName" IS NULL OR "nameLastName" = '' THEN $${params.length} ELSE "nameLastName" END`,
        );
      }
    }

    if (setClauses.length === 0) {
      return false;
    }

    await this.workspaceQueryService.executeWorkspaceRawQuery(
      `
        UPDATE ${memberTable}
        SET ${setClauses.join(', ')}
        WHERE id = $1 AND "deletedAt" IS NULL
      `,
      params,
      workspaceId,
    );

    return true;
  }

  private async readOrgChartRempoints(
    schema: string,
    workspaceId: string,
    profileRows: ProfileRow[],
  ): Promise<Array<{ orgChartId: string; memberId: string }>> {
    const orgChartTableName = await this.resolveOrgChartTableName(schema);

    if (!orgChartTableName) {
      return [];
    }

    const hasCreatedByProfile =
      await this.workspaceQueryService.checkIfColumnExists(
        schema,
        orgChartTableName,
        'createdByProfileId',
        { silent: true },
      );

    if (!hasCreatedByProfile) {
      return [];
    }

    const profileIdToMemberId = new Map(
      profileRows
        .filter((row) => row.workspaceMemberId)
        .map((row) => [row.id, row.workspaceMemberId as string]),
    );

    if (profileIdToMemberId.size === 0) {
      return [];
    }

    const orgCharts =
      (await this.workspaceQueryService.executeWorkspaceRawQuery(
        `
        SELECT id, "createdByProfileId", "recruiterId"
        FROM ${schema}."${orgChartTableName}"
        WHERE "deletedAt" IS NULL
          AND "createdByProfileId" IS NOT NULL
      `,
        [],
        workspaceId,
      )) as {
        id: string;
        createdByProfileId: string | null;
        recruiterId: string | null;
      }[];

    const rempoints: Array<{ orgChartId: string; memberId: string }> = [];

    for (const orgChart of orgCharts ?? []) {
      if (orgChart.recruiterId) {
        continue;
      }

      const memberId = orgChart.createdByProfileId
        ? profileIdToMemberId.get(orgChart.createdByProfileId)
        : undefined;

      if (!memberId) {
        continue;
      }

      rempoints.push({ orgChartId: orgChart.id, memberId });
    }

    return rempoints;
  }

  private async applyOrgChartRempoints(
    schema: string,
    workspaceId: string,
    rempoints: Array<{ orgChartId: string; memberId: string }>,
  ): Promise<number> {
    const orgChartTableName = await this.resolveOrgChartTableName(schema);

    if (!orgChartTableName) {
      return 0;
    }

    const hasRecruiter = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      orgChartTableName,
      'recruiterId',
      { silent: true },
    );

    if (!hasRecruiter) {
      return 0;
    }

    let rempointed = 0;

    for (const rempoint of rempoints) {
      await this.workspaceQueryService.executeWorkspaceRawQuery(
        `
          UPDATE ${schema}."${orgChartTableName}"
          SET "recruiterId" = COALESCE("recruiterId", $2)
          WHERE id = $1
        `,
        [rempoint.orgChartId, rempoint.memberId],
        workspaceId,
      );
      rempointed += 1;
    }

    return rempointed;
  }

  private async backfillWorkspaceCompanyFromProfiles(
    workspaceId: string,
    profileRows: ProfileRow[],
  ): Promise<void> {
    const companyName = profileRows
      .map((profile) => profile.companyName?.trim())
      .find((value) => Boolean(value));
    const companyDescription = profileRows
      .map((profile) => profile.companyDescription?.trim())
      .find((value) => Boolean(value));

    if (!companyName && !companyDescription) {
      return;
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return;
    }

    const patch: Partial<WorkspaceEntity> = {};

    if (
      (workspace.companyName == null || workspace.companyName.trim() === '') &&
      companyName
    ) {
      patch.companyName = companyName;
    }

    if (
      (workspace.summary == null || workspace.summary.trim() === '') &&
      companyDescription
    ) {
      patch.summary = companyDescription;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    await this.workspaceRepository.update(workspaceId, patch);
  }
}
