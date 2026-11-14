import { Command } from 'nest-commander';

import chunk from 'lodash.chunk';
import { isNonEmptyString } from '@sniptt/guards';
import {
  buildCompanyAnalyticsRollup,
  mergeLegacyCandidateFieldsIntoAnalytics,
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
import { findEntitiesByIdInBatches } from 'src/database/commands/upgrade-version-command/common/find-entities-by-ids-in-batches.util';
import {
  computeCoverageBucket,
  mapMessagingChannelToOutreachChannel,
} from 'src/domains/engagement/outreach-command/utils/outreach-command-materialize.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

// Pages are read by id so every row is visited exactly once. A plain
// `take: 20_000` scan has no ORDER BY, so it returns an arbitrary window and
// silently skipped everything past the first 20k rows.
const PAGE_SIZE = 1000;

// Writes are grouped into one statement per batch; the per-row update() loop
// this replaces issued one round-trip per changed record.
const WRITE_BATCH_SIZE = 500;

type CandidateRow = ObjectLiteral & {
  id: string;
  createdAt?: string | Date;
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

type AnalyticsPatch = { id: string; outreachAnalytics: unknown };

type ConfigPatch = { id: string; outreachConfig: unknown };

const toIso = (value: string | Date | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

// Iterates every live row of a table in id order, one page at a time, so the
// scan is complete and deterministic regardless of row count.
const forEachRowPage = async <TRow extends ObjectLiteral>({
  queryService,
  workspaceId,
  schemaName,
  tableName,
  columns,
  onPage,
}: {
  queryService: WorkspaceQueryService;
  workspaceId: string;
  schemaName: string;
  tableName: string;
  columns: string[];
  onPage: (rows: TRow[]) => Promise<void>;
}): Promise<void> => {
  const quotedColumns = columns.map((column) => `"${column}"`).join(', ');
  let lastId: string | null = null;

  while (true) {
    const rows: TRow[] = await queryService.executeWorkspaceRawQuery(
      `
        SELECT ${quotedColumns}
        FROM "${schemaName}"."${tableName}"
        WHERE "deletedAt" IS NULL
          AND ($2::uuid IS NULL OR "id" > $2::uuid)
        ORDER BY "id"
        LIMIT $1
      `,
      [PAGE_SIZE, lastId],
      workspaceId,
    );

    if (rows.length === 0) {
      return;
    }

    await onPage(rows);

    lastId = rows[rows.length - 1].id;

    if (rows.length < PAGE_SIZE) {
      return;
    }
  }
};

// Ids are workspace UUIDs and table names come from our own constants, but the
// schema name is interpolated into SQL, so keep the shape pinned.
const assertSafeSchemaName = (schemaName: string): void => {
  if (!/^workspace_[a-z0-9]+$/.test(schemaName)) {
    throw new Error(`Unexpected workspace schema name "${schemaName}"`);
  }
};

const applyAnalyticsPatches = async ({
  queryService,
  workspaceId,
  schemaName,
  tableName,
  patches,
}: {
  queryService: WorkspaceQueryService;
  workspaceId: string;
  schemaName: string;
  tableName: string;
  patches: AnalyticsPatch[];
}): Promise<void> => {
  for (const batch of chunk(patches, WRITE_BATCH_SIZE)) {
    await queryService.executeWorkspaceRawQuery(
      `
        UPDATE "${schemaName}"."${tableName}" AS target
        SET "outreachAnalytics" = source.value::jsonb,
            "updatedAt" = NOW()
        FROM (
          SELECT unnest($1::uuid[]) AS id,
                 unnest($2::text[]) AS value
        ) AS source
        WHERE target.id = source.id
      `,
      [
        batch.map((patch) => patch.id),
        batch.map((patch) => JSON.stringify(patch.outreachAnalytics)),
      ],
      workspaceId,
    );
  }
};

const applyConfigPatches = async ({
  queryService,
  workspaceId,
  schemaName,
  patches,
}: {
  queryService: WorkspaceQueryService;
  workspaceId: string;
  schemaName: string;
  patches: ConfigPatch[];
}): Promise<void> => {
  for (const batch of chunk(patches, WRITE_BATCH_SIZE)) {
    await queryService.executeWorkspaceRawQuery(
      `
        UPDATE "${schemaName}"."_project" AS target
        SET "outreachConfig" = source.value::jsonb,
            "updatedAt" = NOW()
        FROM (
          SELECT unnest($1::uuid[]) AS id,
                 unnest($2::text[]) AS value
        ) AS source
        WHERE target.id = source.id
      `,
      [
        batch.map((patch) => patch.id),
        batch.map((patch) => JSON.stringify(patch.outreachConfig)),
      ],
      workspaceId,
    );
  }
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
    private readonly workspaceQueryService: WorkspaceQueryService,
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

    const schemaName = getWorkspaceSchemaName(workspaceId);

    assertSafeSchemaName(schemaName);

    // "_candidate" and "_project" are the physical tables the live workspaces
    // use; company/person keep their unprefixed names. Resolve each explicitly
    // instead of assuming a single naming convention.
    const candidateTable = (await this.workspaceQueryService.checkIfTableExists(
      schemaName,
      '_candidate',
    ))
      ? '_candidate'
      : 'candidate';

    const companyTable = (await this.workspaceQueryService.checkIfTableExists(
      schemaName,
      'company',
    ))
      ? 'company'
      : '_company';

    const personTable = (await this.workspaceQueryService.checkIfTableExists(
      schemaName,
      'person',
    ))
      ? 'person'
      : '_person';

    let stampedCandidates = 0;

    await forEachRowPage<CandidateRow>({
      queryService: this.workspaceQueryService,
      workspaceId,
      schemaName,
      tableName: candidateTable,
      columns: CANDIDATE_COLUMNS,
      onPage: async (candidates) => {
        const patches: AnalyticsPatch[] = [];
        const candidatesByCompanyId = new Map<
          string,
          Array<{ candidate: CandidateRow; analytics: unknown }>
        >();

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

          // Company rollups read the merged analytics, so keep them for the
          // company pass even when no candidate update is needed.
          if (isNonEmptyString(candidate.peopleId)) {
            const forCompany =
              candidatesByCompanyId.get(candidate.peopleId) ?? [];

            forCompany.push({ candidate, analytics: merged });
            candidatesByCompanyId.set(candidate.peopleId, forCompany);
          }

          if (
            JSON.stringify(existing) === JSON.stringify(merged) &&
            candidate.outreachAnalytics !== undefined &&
            candidate.outreachAnalytics !== null
          ) {
            continue;
          }

          patches.push({ id: candidate.id, outreachAnalytics: merged });
        }

        await applyAnalyticsPatches({
          queryService: this.workspaceQueryService,
          workspaceId,
          schemaName,
          tableName: candidateTable,
          patches,
        });

        stampedCandidates += patches.length;

        // Candidates are keyed by person; people carry the company relation.
        const peopleIds = [...candidatesByCompanyId.keys()];
        const peopleById = await findEntitiesByIdInBatches<PersonRow>(
          async (personIds) =>
            this.workspaceQueryService.executeWorkspaceRawQuery<PersonRow[]>(
              `
                SELECT id, "companyId"
                FROM "${schemaName}"."${personTable}"
                WHERE "id" = ANY($1::uuid[])
              `,
              [personIds],
              workspaceId,
            ),
          peopleIds,
        );

        const candidatesByCompany = new Map<
          string,
          Array<{ candidate: CandidateRow; analytics: unknown }>
        >();

        for (const [personId, forPerson] of candidatesByCompanyId) {
          const companyId = peopleById.get(personId)?.companyId ?? null;

          if (!isNonEmptyString(companyId)) {
            continue;
          }

          const forCompany = candidatesByCompany.get(companyId) ?? [];

          forCompany.push(...forPerson);
          candidatesByCompany.set(companyId, forCompany);
        }

        await this.rebuildCompanyRollups({
          workspaceId,
          schemaName,
          companyTable,
          candidatesByCompany,
        });
      },
    });

    let stampedProjects = 0;

    await forEachRowPage<ProjectRow>({
      queryService: this.workspaceQueryService,
      workspaceId,
      schemaName,
      tableName: '_project',
      columns: PROJECT_COLUMNS,
      onPage: async (projects) => {
        const patches: ConfigPatch[] = [];

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

          patches.push({ id: project.id, outreachConfig: mergedConfig });
        }

        await applyConfigPatches({
          queryService: this.workspaceQueryService,
          workspaceId,
          schemaName,
          patches,
        });

        stampedProjects += patches.length;
      },
    });

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatPageLayoutMaps',
      'flatViewMaps',
    ]);

    this.logger.log(
      `Migrated outreach analytics on ${stampedCandidates} candidates and ${stampedProjects} projects for workspace ${workspaceId}`,
    );
  }

  private async rebuildCompanyRollups({
    workspaceId,
    schemaName,
    companyTable,
    candidatesByCompany,
  }: {
    workspaceId: string;
    schemaName: string;
    companyTable: string;
    candidatesByCompany: Map<
      string,
      Array<{ candidate: CandidateRow; analytics: unknown }>
    >;
  }): Promise<void> {
    const companyIds = [...candidatesByCompany.keys()];

    // Companies without a candidate in this page keep their existing rollup.
    for (const companyIdBatch of chunk(companyIds, PAGE_SIZE)) {
      const companies =
        await this.workspaceQueryService.executeWorkspaceRawQuery<CompanyRow[]>(
          `
            SELECT ${COMPANY_COLUMNS.map((column) => `"${column}"`).join(', ')}
            FROM "${schemaName}"."${companyTable}"
            WHERE "id" = ANY($1::uuid[])
              AND "deletedAt" IS NULL
          `,
          [companyIdBatch],
          workspaceId,
        );

      const patches: AnalyticsPatch[] = [];

      for (const company of companies) {
        const forCompany = candidatesByCompany.get(company.id) ?? [];
        const peopleTargeted = forCompany.length;
        const peopleReached = forCompany.filter(({ candidate, analytics }) =>
          isNonEmptyString(
            resolveOutreachFirstOutboundAt(
              analytics,
              toIso(candidate.firstOutboundAt),
            ),
          ),
        ).length;
        const firstContactCandidates = forCompany
          .map(({ analytics }) => resolveOutreachFirstContactAt(analytics))
          .filter(isNonEmptyString)
          .sort();
        const channelsUsed = Array.from(
          new Set(
            forCompany
              .map(({ candidate }) =>
                mapMessagingChannelToOutreachChannel(
                  candidate.messagingChannel,
                ),
              )
              .filter((channel) => channel !== 'OTHER'),
          ),
        );

        const rollup = buildCompanyAnalyticsRollup({
          existingAnalytics: company.outreachAnalytics,
          companyCreatedAt: toIso(company.createdAt),
          peopleTargeted: company.peopleTargeted ?? peopleTargeted,
          peopleReached: company.peopleReached ?? peopleReached,
          coverageScore:
            company.coverageScore ??
            Math.min(
              100,
              Math.round(
                ((company.peopleReached ?? peopleReached) /
                  Math.max(
                    (company.peopleTargeted ?? peopleTargeted) || 1,
                    1,
                  )) *
                  100,
              ),
            ),
          coverageBucket:
            company.coverageBucket ??
            computeCoverageBucket(company.peopleReached ?? peopleReached),
          channelsUsed: company.channelsUsed ?? channelsUsed,
          firstContactAt:
            toIso(company.firstContactAt) ?? firstContactCandidates[0] ?? null,
          firstReplyAt: toIso(company.firstReplyAt),
          meetingBookedAt: toIso(company.meetingBookedAt),
          meetingHeldAt: toIso(company.meetingHeldAt),
          firstContactChannel: company.firstContactChannel ?? null,
        });

        const existing = parseOutreachAnalytics(company.outreachAnalytics);

        if (
          JSON.stringify(existing) === JSON.stringify(rollup.outreachAnalytics)
        ) {
          continue;
        }

        patches.push({
          id: company.id,
          outreachAnalytics: rollup.outreachAnalytics,
        });
      }

      await applyAnalyticsPatches({
        queryService: this.workspaceQueryService,
        workspaceId,
        schemaName,
        tableName: companyTable,
        patches,
      });
    }
  }
}

const CANDIDATE_COLUMNS = [
  'id',
  'createdAt',
  'firstOutboundAt',
  'lastOutboundAt',
  'lastInboundAt',
  'outreachSequenceStage',
  'outreachSpeedTimestamps',
  'outreachAnalytics',
  'lastOutboundMessageKind',
  'convertedOnMessageKind',
  'daysToFirstContact',
  'daysToMeetingBooked',
  'daysFromConnectionToAccept',
  'daysFromConnectionToMeeting',
  'timeToFirstContactBucket',
  'timeToMeetingBucket',
  'messagingChannel',
  'peopleId',
];

const COMPANY_COLUMNS = [
  'id',
  'createdAt',
  'outreachAnalytics',
  'peopleTargeted',
  'peopleReached',
  'coverageScore',
  'coverageBucket',
  'channelsUsed',
  'firstContactAt',
  'firstReplyAt',
  'meetingBookedAt',
  'meetingHeldAt',
  'daysToFirstContact',
  'daysToMeetingBooked',
  'timeToFirstContactBucket',
  'timeToMeetingBucket',
  'firstContactChannel',
];

const PROJECT_COLUMNS = [
  'id',
  'outreachConfig',
  'maxPersonasPerCompany',
  'inMailFallbackEnabled',
  'sendTimezone',
  'sendWindowStart',
  'sendWindowEnd',
  'sendWindowDays',
  'icpSpec',
  'experimentConfig',
];
