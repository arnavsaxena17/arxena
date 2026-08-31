import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import {
  resolveOutreachFirstContactAt,
  resolveOutreachFirstOutboundAt,
} from 'twenty-shared/arx';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import {
  appendProjectId,
  parseProjectIds,
} from 'src/engine/core-modules/outreach-command/utils/project-ids.util';
import {
  computeCoverageBucket,
  rollupOutreachFunnelStage,
} from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CandidateRow = ObjectLiteral & {
  id: string;
  firstOutboundAt?: string | Date | null;
  outreachSpeedTimestamps?: unknown;
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

type PersonRow = ObjectLiteral & {
  id: string;
  companyId?: string | null;
};

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

@RegisteredWorkspaceCommand('2.25.0', 1785600000085)
@Command({
  name: 'upgrade:2-25:re-backfill-outreach-company-rollups',
  description:
    'Re-stamp company projectIds, funnel stage, and coverage rollups from linked outreach candidates (post GTM field rename)',
})
export class ReBackfillOutreachCompanyRollupsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Re-backfilling outreach company rollups for workspace ${workspaceId}`,
    );

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
        const personRepository =
          await this.globalWorkspaceOrmManager.getRepository<PersonRow>(
            workspaceId,
            'person',
            { shouldBypassPermissionChecks: true },
          );

        const [candidates, companies, people] = await Promise.all([
          candidateRepository.find({ take: 20_000 }),
          companyRepository.find({ take: 20_000 }),
          personRepository.find({ take: 20_000 }),
        ]);

        const personById = new Map(people.map((person) => [person.id, person]));
        const companyById = new Map(companies.map((company) => [company.id, company]));
        const projectIdsByCompany = new Map<string, Set<string>>();
        const reachedByCompany = new Map<string, string[]>();
        const firstContactByCompany = new Map<string, string[]>();
        const targetedByCompany = new Map<string, number>();

        for (const candidate of candidates) {
          const companyId =
            personById.get(candidate.peopleId ?? '')?.companyId ?? null;

          if (!isNonEmptyString(companyId)) {
            continue;
          }

          if (isNonEmptyString(candidate.projectsId)) {
            const projectIds =
              projectIdsByCompany.get(companyId) ?? new Set<string>();

            projectIds.add(candidate.projectsId);
            projectIdsByCompany.set(companyId, projectIds);
          }

          targetedByCompany.set(
            companyId,
            (targetedByCompany.get(companyId) ?? 0) + 1,
          );

          const firstOutboundAt = resolveOutreachFirstOutboundAt(
            candidate.outreachSpeedTimestamps,
            toIso(candidate.firstOutboundAt),
          );

          if (isNonEmptyString(firstOutboundAt)) {
            const reachedAt = reachedByCompany.get(companyId) ?? [];

            reachedAt.push(firstOutboundAt);
            reachedByCompany.set(companyId, reachedAt);
          }

          const firstContactAt = resolveOutreachFirstContactAt(
            candidate.outreachSpeedTimestamps,
          );

          if (isNonEmptyString(firstContactAt)) {
            const contacts = firstContactByCompany.get(companyId) ?? [];

            contacts.push(firstContactAt);
            firstContactByCompany.set(companyId, contacts);
          }
        }

        const touchedCompanyIds = new Set([
          ...projectIdsByCompany.keys(),
          ...targetedByCompany.keys(),
        ]);

        let stampedCompanies = 0;

        for (const companyId of touchedCompanyIds) {
          const company = companyById.get(companyId);

          if (!company) {
            continue;
          }

          const reachedAt = reachedByCompany.get(companyId) ?? [];
          const peopleReached = reachedAt.length;
          const peopleTargeted = targetedByCompany.get(companyId) ?? 0;
          const firstContactAt =
            toIso(company.firstContactAt) ??
            [...(firstContactByCompany.get(companyId) ?? [])].sort()[0] ??
            null;
          const outreachFunnelStage = rollupOutreachFunnelStage({
            current: company.outreachFunnelStage ?? 'ADDED',
            event: peopleReached > 0 ? 'connection_sent' : 'enrich_started',
            peopleReached,
          });
          const nextProjectIds = appendProjectId(
            company.projectIds,
            ...[...(projectIdsByCompany.get(companyId) ?? [])],
          );
          const patch: Record<string, unknown> = {};

          if (
            JSON.stringify(parseProjectIds(company.projectIds).sort()) !==
            JSON.stringify(nextProjectIds.sort())
          ) {
            patch.projectIds = nextProjectIds;
          }

          if (company.outreachFunnelStage !== outreachFunnelStage) {
            patch.outreachFunnelStage = outreachFunnelStage;
          }

          if (
            !isNonEmptyString(toIso(company.firstContactAt)) &&
            isNonEmptyString(firstContactAt)
          ) {
            patch.firstContactAt = firstContactAt;
          }

          if ((company.peopleReached ?? 0) !== peopleReached) {
            patch.peopleReached = peopleReached;
          }

          if ((company.peopleTargeted ?? 0) !== peopleTargeted) {
            patch.peopleTargeted = peopleTargeted;
          }

          const coverageBucket = computeCoverageBucket(peopleReached);

          patch.coverageBucket = coverageBucket;

          if (Object.keys(patch).length === 0) {
            continue;
          }

          stampedCompanies += 1;

          if (!isDryRun) {
            await companyRepository.update(company.id, patch);
          }
        }

        this.logger.log(
          `Re-backfilled rollups on ${stampedCompanies} of ${touchedCompanyIds.size} outreach-linked companies`,
        );
      },
      authContext,
    );
  }
}
