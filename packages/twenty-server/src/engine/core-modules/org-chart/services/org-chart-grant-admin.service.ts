import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { graphqlToAddNewProject, type OrgChartData } from 'twenty-shared';
import { assertIsDefinedOrThrow, isDefined } from 'twenty-shared/utils';
import { DataSource, IsNull, type Repository } from 'typeorm';

import { AdminGrantOrgChartToWorkspaceInput } from 'src/engine/core-modules/admin-panel/dtos/admin-grant-org-chart-to-workspace.input';
import {
  AdminGrantOrgChartToWorkspaceOutput,
  AdminOrgChartArtifactOutput,
} from 'src/engine/core-modules/admin-panel/dtos/admin-grant-org-chart-to-workspace.output';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

import { OrgChartRecordWorkspaceService } from './org-chart-record-workspace.service';
import { OrgChartS3Service } from './orgchart-s3.service';

@Injectable()
export class OrgChartGrantAdminService {
  private readonly logger = new Logger(OrgChartGrantAdminService.name);

  constructor(
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly orgChartRecordWorkspaceService: OrgChartRecordWorkspaceService,
    private readonly creditTransactionService: CreditTransactionService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly accessTokenService: AccessTokenService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {}

  async lookupOrgChartArtifact(
    companyIdInput: string,
  ): Promise<AdminOrgChartArtifactOutput> {
    const companyId = companyIdInput.trim();

    if (!companyId) {
      throw new BadRequestException('companyId is required');
    }

    const persistedKey = this.orgChartS3Service.persistedCompanyFolderKey(
      companyId,
      companyId,
    );
    const orgChartS3RelativePath =
      this.orgChartS3Service.buildRelativeFolderPathFromPersistedKey(
        persistedKey,
      );
    const orgChart = await this.orgChartS3Service.getOrgChart(persistedKey);
    const companyName = this.resolveCompanyName(orgChart, companyId);
    const itemCount = this.resolveItemCount(orgChart);

    return {
      companyId: persistedKey,
      orgChartS3RelativePath,
      hasOrgChartInS3: isDefined(orgChart),
      companyName,
      itemCount,
    };
  }

  async grantOrgChartToWorkspace(
    input: AdminGrantOrgChartToWorkspaceInput,
  ): Promise<AdminGrantOrgChartToWorkspaceOutput> {
    const workspaceId = input.workspaceId.trim();
    const companyIdInput = input.companyId.trim();

    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }

    if (!companyIdInput) {
      throw new BadRequestException('companyId is required');
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, deletedAt: IsNull() },
    });

    assertIsDefinedOrThrow(
      workspace,
      new AuthException('Workspace not found', AuthExceptionCode.INVALID_INPUT),
    );

    const persistedKey = this.orgChartS3Service.persistedCompanyFolderKey(
      companyIdInput,
      input.companyName?.trim() || companyIdInput,
    );
    const orgChartS3RelativePath =
      this.orgChartS3Service.buildRelativeFolderPathFromPersistedKey(
        persistedKey,
      );
    const orgChart = await this.orgChartS3Service.getOrgChart(persistedKey);

    if (!orgChart) {
      throw new NotFoundException(
        `No orgchart.json found in S3 for companyId=${persistedKey} (path=${orgChartS3RelativePath})`,
      );
    }

    const companyName =
      input.companyName?.trim() ||
      this.resolveCompanyName(orgChart, persistedKey) ||
      persistedKey;
    const itemCount = this.resolveItemCount(orgChart) ?? 0;

    const alreadyHadAccess =
      await this.creditTransactionService.hasOrgChartS3AccessForWorkspace(
        workspaceId,
        orgChartS3RelativePath,
        persistedKey,
      );

    const { workspaceMemberId, apiToken } =
      await this.resolveWorkspaceMemberAuth(workspace);

    let accessGranted = false;
    let chargedCredits = false;

    if (!alreadyHadAccess) {
      if (input.chargeCredits === true) {
        await this.workspaceCreditsService.debitOrgChartCredits(
          workspaceId,
          itemCount,
          {
            companyName,
            companyId: persistedKey,
            workspaceMemberId,
            orgChartS3RelativePath,
          },
        );
        chargedCredits = true;
        accessGranted = true;
      } else {
        await this.creditTransactionService.recordOrgChartAccessGrant({
          workspaceId,
          workspaceMemberId,
          orgChartS3RelativePath,
          companyName,
          companyId: persistedKey,
          employeeCount: itemCount,
        });
        accessGranted = true;
      }
    }

    let orgChartRecordId: string | undefined;
    const shouldCreateCrmRow = input.createCrmRow !== false;

    if (shouldCreateCrmRow) {
      orgChartRecordId =
        await this.orgChartRecordWorkspaceService.tryPersistOrgChartRecord({
          apiToken,
          mode: 'entire_company',
          searchType: 'classic',
          resolvedCompanyName: companyName,
          companyId: persistedKey,
          itemCount,
          orgChartS3RelativePath,
          chartKindOverride: 'FULL',
        });
    }

    let projectName: string | undefined;
    let projectCreated = false;
    const shouldCreateProject = input.createProject === true;

    if (shouldCreateProject) {
      projectName = `orgchart-${companyName.replace(/\s+/g, '-')}-entire`;
      try {
        await this.staticGraphQLService.executeGraphQL(
          graphqlToAddNewProject,
          { input: { name: projectName, position: 'first' } },
          apiToken,
        );
        projectCreated = true;
        this.logger.log(
          `Created project "${projectName}" for workspace=${workspaceId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Could not create project "${projectName}" for workspace=${workspaceId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `Admin granted org chart companyId=${persistedKey} path=${orgChartS3RelativePath} to workspace=${workspaceId} alreadyHadAccess=${alreadyHadAccess} accessGranted=${accessGranted} chargedCredits=${chargedCredits} crmId=${orgChartRecordId ?? 'none'}`,
    );

    return {
      workspaceId,
      companyId: persistedKey,
      orgChartS3RelativePath,
      alreadyHadAccess,
      accessGranted,
      chargedCredits,
      orgChartRecordId,
      projectName,
      projectCreated: shouldCreateProject ? projectCreated : undefined,
      itemCount,
      companyName,
    };
  }

  private async resolveWorkspaceMemberAuth(
    workspace: WorkspaceEntity,
  ): Promise<{ workspaceMemberId: string; apiToken: string }> {
    const schema =
      workspace.databaseSchema && workspace.databaseSchema.trim() !== ''
        ? workspace.databaseSchema
        : getWorkspaceSchemaName(workspace.id);

    const memberRows = await this.coreDataSource.query(
      `SELECT id, "userId" FROM ${schema}."workspaceMember"
       WHERE "deletedAt" IS NULL
       ORDER BY "createdAt" ASC
       LIMIT 1`,
    );

    if (!memberRows?.length) {
      throw new BadRequestException(
        `Workspace ${workspace.id} has no workspace members`,
      );
    }

    const memberRow = memberRows[0] as { id: string; userId: string };
    const workspaceMemberId = String(memberRow.id);
    const userId = String(memberRow.userId);

    const authTokenPair = await this.accessTokenService.generateAccessToken({
      userId,
      workspaceId: workspace.id,
      authProvider: AuthProviderEnum.Password,
    });

    const authContext = await this.accessTokenService.validateToken(
      authTokenPair.token,
    );

    if (authContext.workspaceMemberId !== workspaceMemberId) {
      throw new AuthException(
        'Workspace member mismatch for generated access token',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    return {
      workspaceMemberId,
      apiToken: authTokenPair.token,
    };
  }

  private resolveCompanyName(
    orgChart: OrgChartData | null,
    fallbackCompanyId: string,
  ): string | undefined {
    if (!orgChart) {
      return undefined;
    }

    const fromChart =
      (typeof orgChart.job_company_name === 'string' &&
        orgChart.job_company_name.trim()) ||
      undefined;

    if (fromChart) {
      return fromChart;
    }

    return fallbackCompanyId.replace(/_/g, ' ').replace(/-/g, ' ');
  }

  private resolveItemCount(orgChart: OrgChartData | null): number | undefined {
    if (!orgChart) {
      return undefined;
    }

    if (typeof orgChart.count_org === 'number') {
      return orgChart.count_org;
    }

    if (typeof orgChart.itemCount === 'number') {
      return orgChart.itemCount;
    }

    if (typeof orgChart.people_count === 'number') {
      return orgChart.people_count;
    }

    if (typeof orgChart.peopleCount === 'number') {
      return orgChart.peopleCount;
    }

    return undefined;
  }
}
