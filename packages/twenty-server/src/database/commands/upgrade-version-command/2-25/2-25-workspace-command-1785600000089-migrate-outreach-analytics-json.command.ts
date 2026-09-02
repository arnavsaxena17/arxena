import { Command } from 'nest-commander';

import { isNonEmptyString } from '@sniptt/guards';
import {
  buildCompanyAnalyticsRollup,
  mergeLegacyCandidateFieldsIntoAnalytics,
  mergeLegacyCompanyFieldsIntoAnalytics,
  mergeLegacyProjectFieldsIntoConfig,
  parseOutreachAnalytics,
  parseOutreachConfig,
  resolveOutreachFirstContactAt,
  resolveOutreachFirstOutboundAt,
} from 'twenty-shared/arx';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import {
  computeCoverageBucket,
  mapMessagingChannelToOutreachChannel,
} from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type CandidateRow = ObjectLiteral & {
  id: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  firstOutboundAt?: string | Date | null;
  lastOutboundAt?: string | Date | null;
  lastInboundAt?: string | Date | null;
  outreachSequenceStage?: string | null;
  outreachSpeedTimestamps?: unknown;
  outreachAnalytics?: unknown;
  lastOutboundMessageKind?: string | null;
  convertedOnMessageKind?: string | null;
  daysToFirstContact?: number | null;
  daysToMeetingBooked?: number | null;
  daysFromConnectionToAccept?: number | null;
  daysFromConnectionToMeeting?: number | null;
  timeToFirstContactBucket?: string | null;
  timeToMeetingBucket?: string | null;
  messagingChannel?: string | null;
  projectsId?: string | null;
  peopleId?: string | null;
};

type CompanyRow = ObjectLiteral & {
  id: string;
  createdAt?: string | Date;
  outreachAnalytics?: unknown;
  peopleTargeted?: number | null;
  peopleReached?: number | null;
  coverageScore?: number | null;
  coverageBucket?: string | null;
  channelsUsed?: string[] | null;
  firstContactAt?: string | Date | null;
  firstReplyAt?: string | Date | null;
  meetingBookedAt?: string | Date | null;
  meetingHeldAt?: string | Date | null;
  daysToFirstContact?: number | null;
  daysToMeetingBooked?: number | null;
  timeToFirstContactBucket?: string | null;
  timeToMeetingBucket?: string | null;
  firstContactChannel?: string | null;
};

type PersonRow = ObjectLiteral & {
  id: string;
  companyId?: string | null;
};

type ProjectRow = ObjectLiteral & {
  id: string;
  outreachConfig?: unknown;
  maxPersonasPerCompany?: number | null;
  inMailFallbackEnabled?: boolean | null;
  sendTimezone?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  sendWindowDays?: string | null;
  icpSpec?: string | null;
  experimentConfig?: string | null;
};

const toIso = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000089)
@Command({
  name: 'upgrade:2-25:migrate-outreach-analytics-json',
  description:
    'Consolidate outreach analytics/config into RAW_JSON fields, backfill legacy flat fields, and re-sync Outreach dashboard widgets',
})
export class MigrateOutreachAnalyticsJsonCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Migrating outreach analytics JSON for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const authContext = buildSystemAuthContext(workspaceId);
    let stampedCandidates = 0;
    let stampedCompanies = 0;
    let stampedProjects = 0;

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
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRow>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        const [candidates, companies, people, projects] = await Promise.all([
          candidateRepository.find({ take: 20_000 }),
          companyRepository.find({ take: 20_000 }),
          personRepository.find({ take: 20_000 }),
          projectRepository.find({ take: 20_000 }),
        ]);

        const personById = new Map(people.map((person) => [person.id, person]));

        for (const candidate of candidates) {
          const legacyTimestamps =
            candidate.outreachSpeedTimestamps ?? candidate.outreachAnalytics;
          const merged = mergeLegacyCandidateFieldsIntoAnalytics({
            existingAnalytics: legacyTimestamps,
            createdAt: toIso(candidate.createdAt),
            firstOutboundAt: toIso(candidate.firstOutboundAt),
            lastOutboundAt: toIso(candidate.lastOutboundAt),
            lastInboundAt: toIso(candidate.lastInboundAt),
            lastOutboundMessageKind: candidate.lastOutboundMessageKind,
            convertedOnMessageKind: candidate.convertedOnMessageKind,
            daysToFirstContact: candidate.daysToFirstContact,
            daysToMeetingBooked: candidate.daysToMeetingBooked,
            daysFromConnectionToAccept: candidate.daysFromConnectionToAccept,
            daysFromConnectionToMeeting: candidate.daysFromConnectionToMeeting,
            timeToFirstContactBucket: candidate.timeToFirstContactBucket as
              | 'UNDER_1D'
              | 'D1_3'
              | 'D3_7'
              | 'D7_14'
              | 'OVER_14D'
              | null,
            timeToMeetingBucket: candidate.timeToMeetingBucket as
              | 'UNDER_1D'
              | 'D1_3'
              | 'D3_7'
              | 'D7_14'
              | 'OVER_14D'
              | null,
            outreachSequenceStage: candidate.outreachSequenceStage,
          });

          const existing = parseOutreachAnalytics(candidate.outreachAnalytics);

          if (
            JSON.stringify(existing) === JSON.stringify(merged) &&
            candidate.outreachAnalytics !== undefined &&
            candidate.outreachAnalytics !== null
          ) {
            continue;
          }

          await candidateRepository.update(candidate.id, {
            outreachAnalytics: merged,
          });
          stampedCandidates += 1;
        }

        const candidatesByCompany = new Map<string, CandidateRow[]>();

        for (const candidate of candidates) {
          const companyId =
            personById.get(candidate.peopleId ?? '')?.companyId ?? null;

          if (!isNonEmptyString(companyId)) {
            continue;
          }

          const companyCandidates = candidatesByCompany.get(companyId) ?? [];

          companyCandidates.push(candidate);
          candidatesByCompany.set(companyId, companyCandidates);
        }

        for (const company of companies) {
          const companyCandidates = candidatesByCompany.get(company.id) ?? [];
          const peopleTargeted = companyCandidates.length;
          const peopleReached = companyCandidates.filter((candidate) =>
            isNonEmptyString(
              resolveOutreachFirstOutboundAt(
                candidate.outreachAnalytics ?? candidate.outreachSpeedTimestamps,
                toIso(candidate.firstOutboundAt),
              ),
            ),
          ).length;
          const firstContactCandidates = companyCandidates
            .map((candidate) =>
              resolveOutreachFirstContactAt(
                candidate.outreachAnalytics ?? candidate.outreachSpeedTimestamps,
              ),
            )
            .filter(isNonEmptyString)
            .sort();
          const channelsUsed = Array.from(
            new Set(
              companyCandidates
                .map((candidate) =>
                  mapMessagingChannelToOutreachChannel(candidate.messagingChannel),
                )
                .filter((channel) => channel !== 'OTHER'),
            ),
          );

          const mergedFlat = mergeLegacyCompanyFieldsIntoAnalytics({
            existingAnalytics: company.outreachAnalytics,
            createdAt: toIso(company.createdAt),
            peopleTargeted: company.peopleTargeted ?? peopleTargeted,
            peopleReached: company.peopleReached ?? peopleReached,
            coverageScore: company.coverageScore ?? null,
            coverageBucket:
              company.coverageBucket ?? computeCoverageBucket(peopleReached),
            channelsUsed: company.channelsUsed ?? channelsUsed,
            firstContactAt:
              toIso(company.firstContactAt) ?? firstContactCandidates[0] ?? null,
            firstReplyAt: toIso(company.firstReplyAt),
            meetingBookedAt: toIso(company.meetingBookedAt),
            meetingHeldAt: toIso(company.meetingHeldAt),
            daysToFirstContact: company.daysToFirstContact,
            daysToMeetingBooked: company.daysToMeetingBooked,
            timeToFirstContactBucket: company.timeToFirstContactBucket as
              | 'UNDER_1D'
              | 'D1_3'
              | 'D3_7'
              | 'D7_14'
              | 'OVER_14D'
              | null,
            timeToMeetingBucket: company.timeToMeetingBucket as
              | 'UNDER_1D'
              | 'D1_3'
              | 'D3_7'
              | 'D7_14'
              | 'OVER_14D'
              | null,
            firstContactChannel: company.firstContactChannel,
          });

          const rollup = buildCompanyAnalyticsRollup({
            existingAnalytics: mergedFlat,
            companyCreatedAt: toIso(company.createdAt),
            peopleTargeted: mergedFlat.peopleTargeted ?? peopleTargeted,
            peopleReached: mergedFlat.peopleReached ?? peopleReached,
            coverageScore:
              mergedFlat.coverageScore ??
              Math.min(
                100,
                Math.round(
                  ((mergedFlat.peopleReached ?? peopleReached) /
                    Math.max(
                      (mergedFlat.peopleTargeted ?? peopleTargeted) || 1,
                      1,
                    )) *
                    100,
                ),
              ),
            coverageBucket:
              mergedFlat.coverageBucket ??
              computeCoverageBucket(mergedFlat.peopleReached ?? peopleReached),
            channelsUsed: mergedFlat.channelsUsed ?? channelsUsed,
            firstContactAt: mergedFlat.firstContactAt ?? null,
            firstReplyAt: mergedFlat.firstReplyAt ?? null,
            meetingBookedAt: mergedFlat.meetingBookedAt ?? null,
            meetingHeldAt: mergedFlat.meetingHeldAt ?? null,
            firstContactChannel: mergedFlat.firstContactChannel ?? null,
          });

          const existing = parseOutreachAnalytics(company.outreachAnalytics);

          if (
            JSON.stringify(existing) ===
            JSON.stringify(rollup.outreachAnalytics)
          ) {
            continue;
          }

          await companyRepository.update(company.id, rollup);
          stampedCompanies += 1;
        }

        for (const project of projects) {
          const mergedConfig = mergeLegacyProjectFieldsIntoConfig({
            existingConfig: project.outreachConfig,
            maxPersonasPerCompany: project.maxPersonasPerCompany,
            inMailFallbackEnabled: project.inMailFallbackEnabled,
            sendTimezone: project.sendTimezone,
            sendWindowStart: project.sendWindowStart,
            sendWindowEnd: project.sendWindowEnd,
            sendWindowDays: project.sendWindowDays,
            icpSpec: project.icpSpec,
            experimentConfig: project.experimentConfig,
          });

          const existing = parseOutreachConfig(project.outreachConfig);

          if (
            JSON.stringify(existing) === JSON.stringify(mergedConfig) &&
            project.outreachConfig !== undefined &&
            project.outreachConfig !== null
          ) {
            continue;
          }

          await projectRepository.update(project.id, {
            outreachConfig: mergedConfig,
          });
          stampedProjects += 1;
        }
      },
      authContext,
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatPageLayoutMaps',
      'flatViewMaps',
    ]);

    this.logger.log(
      `Migrated outreach analytics on ${stampedCandidates} candidates, ${stampedCompanies} companies, and ${stampedProjects} projects for workspace ${workspaceId}`,
    );
  }
}
