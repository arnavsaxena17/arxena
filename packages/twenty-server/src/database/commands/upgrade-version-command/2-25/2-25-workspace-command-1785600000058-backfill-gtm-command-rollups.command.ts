import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { parseProjectIds } from 'src/engine/core-modules/outreach-command/utils/project-ids.util';
import {
  candidateStageImpliesOutbound,
  computeCoverageBucket,
  rollupOutreachFunnelStage,
} from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type CandidateRow = ObjectLiteral & {
  id: string;
  outreachSequenceStage?: string | null;
  firstOutboundAt?: string | Date | null;
  lastOutboundAt?: string | Date | null;
  updatedAt?: string | Date | null;
  projectsId?: string | null;
  peopleId?: string | null;
};

type CompanyRow = ObjectLiteral & {
  id: string;
  projectIds?: unknown;
  outreachFunnelStage?: string | null;
  firstContactAt?: string | Date | null;
  peopleReached?: number | null;
  peopleTargeted?: number | null;
};

type ProjectRow = ObjectLiteral & {
  id: string;
  companyId?: string | null;
};

type PersonRow = ObjectLiteral & {
  id: string;
  companyId?: string | null;
};

const columnNames = (repository: {
  metadata?: { columns?: Array<{ propertyName?: string }> };
}): Set<string> =>
  new Set(
    (repository.metadata?.columns ?? [])
      .map((column) => column.propertyName)
      .filter((name): name is string => isNonEmptyString(name)),
  );

const toIso = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000058)
@Command({
  name: 'upgrade:2-25:backfill-gtm-command-rollups',
  description:
    'Stamp candidate firstOutboundAt and company GTM funnel/first-contact rollups for existing outreach',
})
export class BackfillOutreachCommandRollupsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Backfilling GTM Command rollups for workspace ${workspaceId}`,
    );

    if (!isDryRun) {
      await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
        { workspaceId },
      );
      await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
        'flatPageLayoutMaps',
      ]);
    }

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRow>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyRow>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRow>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonRow>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const candidateColumns = columnNames(candidateRepository);
        const companyColumns = columnNames(companyRepository);

        if (
          !candidateColumns.has('outreachSequenceStage') ||
          !candidateColumns.has('firstOutboundAt')
        ) {
          this.logger.warn(
            `Skipping candidate firstOutboundAt backfill — fields missing in workspace ${workspaceId}`,
          );

          return;
        }

        const candidates = await candidateRepository.find({ take: 20_000 });
        let stampedCandidates = 0;

        for (const candidate of candidates) {
          if (
            !candidateStageImpliesOutbound(candidate.outreachSequenceStage) ||
            isNonEmptyString(toIso(candidate.firstOutboundAt))
          ) {
            continue;
          }

          const stampedAt =
            toIso(candidate.lastOutboundAt) ??
            toIso(candidate.updatedAt) ??
            new Date().toISOString();
          const patch: Record<string, unknown> = {
            firstOutboundAt: stampedAt,
          };

          if (
            candidateColumns.has('lastOutboundAt') &&
            !isNonEmptyString(toIso(candidate.lastOutboundAt))
          ) {
            patch.lastOutboundAt = stampedAt;
          }

          stampedCandidates += 1;

          if (!isDryRun) {
            await candidateRepository.update(candidate.id, patch);
          }

          Object.assign(candidate, patch);
        }

        if (
          !companyColumns.has('projectIds') ||
          !companyColumns.has('outreachFunnelStage')
        ) {
          this.logger.log(
            `Stamped firstOutboundAt on ${stampedCandidates} candidates; company fields missing`,
          );

          return;
        }

        const [companies, projects, people] = await Promise.all([
          companyRepository.find({ take: 20_000 }),
          projectRepository.find({ take: 20_000 }),
          personRepository.find({ take: 20_000 }),
        ]);
        const projectById = new Map(
          projects.map((project) => [project.id, project]),
        );
        const personById = new Map(people.map((person) => [person.id, person]));
        const companyIdForCandidate = (candidate: CandidateRow): string | null =>
          projectById.get(candidate.projectsId ?? '')?.companyId ??
          personById.get(candidate.peopleId ?? '')?.companyId ??
          null;

        const reachedByCompany = new Map<string, string[]>();
        const targetedByCompany = new Map<string, number>();

        for (const candidate of candidates) {
          const companyId = companyIdForCandidate(candidate);

          if (!isNonEmptyString(companyId)) {
            continue;
          }

          targetedByCompany.set(
            companyId,
            (targetedByCompany.get(companyId) ?? 0) + 1,
          );

          const firstOutboundAt = toIso(candidate.firstOutboundAt);

          if (!isNonEmptyString(firstOutboundAt)) {
            continue;
          }

          const existing = reachedByCompany.get(companyId) ?? [];
          existing.push(firstOutboundAt);
          reachedByCompany.set(companyId, existing);
        }

        let stampedCompanies = 0;

        for (const company of companies) {
          if (parseProjectIds(company.projectIds).length === 0) {
            continue;
          }

          const reachedAt = reachedByCompany.get(company.id) ?? [];
          const peopleReached = reachedAt.length;
          const peopleTargeted = targetedByCompany.get(company.id) ?? 0;
          const firstContactAt =
            toIso(company.firstContactAt) ??
            [...reachedAt].sort()[0] ??
            null;
          const outreachFunnelStage = rollupOutreachFunnelStage({
            current: company.outreachFunnelStage ?? 'ADDED',
            event: peopleReached > 0 ? 'connection_sent' : 'enrich_started',
            peopleReached,
          });
          const patch: Record<string, unknown> = {};

          if (company.outreachFunnelStage !== outreachFunnelStage) {
            patch.outreachFunnelStage = outreachFunnelStage;
          }

          if (
            companyColumns.has('firstContactAt') &&
            !isNonEmptyString(toIso(company.firstContactAt)) &&
            isNonEmptyString(firstContactAt)
          ) {
            patch.firstContactAt = firstContactAt;
          }

          if (
            companyColumns.has('peopleReached') &&
            (company.peopleReached ?? 0) !== peopleReached
          ) {
            patch.peopleReached = peopleReached;
          }

          if (
            companyColumns.has('peopleTargeted') &&
            (company.peopleTargeted ?? 0) !== peopleTargeted
          ) {
            patch.peopleTargeted = peopleTargeted;
          }

          if (companyColumns.has('coverageBucket')) {
            patch.coverageBucket = computeCoverageBucket(peopleReached);
          }

          if (Object.keys(patch).length === 0) {
            continue;
          }

          stampedCompanies += 1;

          if (!isDryRun) {
            await companyRepository.update(company.id, patch);
          }
        }

        this.logger.log(
          `Stamped firstOutboundAt on ${stampedCandidates} candidates and rollups on ${stampedCompanies} companies`,
        );
      },
      authContext,
    );
  }
}
