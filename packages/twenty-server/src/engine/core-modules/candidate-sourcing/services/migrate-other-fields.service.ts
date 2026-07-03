import { Injectable, Logger } from '@nestjs/common';
import {
  buildOtherFieldsFromLegacyRows,
  isJsonColumnEmpty,
  mergeChatQuestionsPreservingOrder,
  mergeOtherFields,
  OtherFieldsRecord,
} from 'twenty-shared';
import { In } from 'typeorm';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

type LegacyFieldValueRow = {
  candidateId: string;
  fieldName: string;
  value: string;
};

type LegacyJobFieldRow = {
  jobId: string;
  name: string;
  position: number | null;
};

export type MigrateOtherFieldsResult = {
  workspaceId: string;
  schema: string;
  jobsUpdated: number;
  candidatesUpdated: number;
  legacyFieldValuesDeleted: number;
  legacyFieldsDeleted: number;
  skipped: boolean;
  skipReason?: string;
};

export type MigrateOtherFieldsOptions = {
  workspaceIds?: string[];
  dryRun?: boolean;
  deleteLegacy?: boolean;
  batchSize?: number;
};

@Injectable()
export class MigrateOtherFieldsService {
  private readonly logger = new Logger(MigrateOtherFieldsService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  async migrateAllWorkspaces(
    options: MigrateOtherFieldsOptions = {},
  ): Promise<MigrateOtherFieldsResult[]> {
    const batchSize = options.batchSize ?? 200;
    const workspaceIds =
      options.workspaceIds?.length &&
      options.workspaceIds.length > 0
        ? options.workspaceIds
        : await this.workspaceQueryService.getWorkspaces();

    const dataSources = await this.workspaceQueryService.dataSourceRepository.find(
      {
        where: { workspaceId: In(workspaceIds) },
      },
    );
    const eligibleWorkspaceIds = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );

    const results: MigrateOtherFieldsResult[] = [];

    for (const workspaceId of workspaceIds) {
      if (!eligibleWorkspaceIds.has(workspaceId)) {
        results.push({
          workspaceId,
          schema: '',
          jobsUpdated: 0,
          candidatesUpdated: 0,
          legacyFieldValuesDeleted: 0,
          legacyFieldsDeleted: 0,
          skipped: true,
          skipReason: 'No workspace datasource',
        });
        continue;
      }

      const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

      try {
        const result = await this.migrateWorkspace(schema, workspaceId, {
          ...options,
          batchSize,
        });
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed migrating workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        results.push({
          workspaceId,
          schema,
          jobsUpdated: 0,
          candidatesUpdated: 0,
          legacyFieldValuesDeleted: 0,
          legacyFieldsDeleted: 0,
          skipped: true,
          skipReason: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await this.workspaceDataSourceService.releaseWorkspaceDataSource(
          workspaceId,
        );
      }
    }

    return results;
  }

  async migrateWorkspace(
    schema: string,
    workspaceId: string,
    options: MigrateOtherFieldsOptions = {},
  ): Promise<MigrateOtherFieldsResult> {
    const batchSize = options.batchSize ?? 200;
    const hasOtherFieldsColumn = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      '_candidate',
      'otherFields',
      { silent: true },
    );
    const hasChatQuestionsColumn = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      '_job',
      'chatQuestions',
      { silent: true },
    );

    if (!hasOtherFieldsColumn || !hasChatQuestionsColumn) {
      return {
        workspaceId,
        schema,
        jobsUpdated: 0,
        candidatesUpdated: 0,
        legacyFieldValuesDeleted: 0,
        legacyFieldsDeleted: 0,
        skipped: true,
        skipReason: 'otherFields or chatQuestions column missing — run workspace:update-all-metadata-from-code first',
      };
    }

    const jobsUpdated = await this.migrateJobChatQuestions(
      schema,
      workspaceId,
      options.dryRun ?? false,
    );
    const candidatesUpdated = await this.migrateCandidateOtherFields(
      schema,
      workspaceId,
      batchSize,
      options.dryRun ?? false,
    );

    let legacyFieldValuesDeleted = 0;
    let legacyFieldsDeleted = 0;

    if (options.deleteLegacy && !options.dryRun) {
      const deleted = await this.deleteLegacyRows(schema, workspaceId);
      legacyFieldValuesDeleted = deleted.fieldValuesDeleted;
      legacyFieldsDeleted = deleted.fieldsDeleted;
    }

    return {
      workspaceId,
      schema,
      jobsUpdated,
      candidatesUpdated,
      legacyFieldValuesDeleted,
      legacyFieldsDeleted,
      skipped: false,
    };
  }

  private async migrateJobChatQuestions(
    schema: string,
    workspaceId: string,
    dryRun: boolean,
  ): Promise<number> {
    const legacyRows = (await this.workspaceQueryService.executeRawQuery(
      `
        SELECT cf."jobsId" as "jobId", cf.name, cf.position
        FROM ${schema}."_candidateField" cf
        WHERE cf."deletedAt" IS NULL
          AND cf."jobsId" IS NOT NULL
          AND cf.name IS NOT NULL
          AND btrim(cf.name::text) <> ''
        ORDER BY cf."jobsId", cf.position ASC NULLS LAST, cf."createdAt" ASC
      `,
      [],
      workspaceId,
    )) as LegacyJobFieldRow[];

    const questionsByJob = new Map<string, string[]>();

    for (const row of legacyRows ?? []) {
      if (!row.jobId || !row.name?.trim()) {
        continue;
      }

      const existing = questionsByJob.get(row.jobId) ?? [];
      questionsByJob.set(
        row.jobId,
        mergeChatQuestionsPreservingOrder(existing, [row.name.trim()]),
      );
    }

    if (questionsByJob.size === 0) {
      return 0;
    }

    const jobsNeedingMigration = (await this.workspaceQueryService.executeRawQuery(
      `
        SELECT j.id, j."chatQuestions"
        FROM ${schema}."_job" j
        WHERE j."deletedAt" IS NULL
          AND j.id = ANY($1::uuid[])
      `,
      [Array.from(questionsByJob.keys())],
      workspaceId,
    )) as { id: string; chatQuestions: unknown }[];

    let updatedCount = 0;

    for (const job of jobsNeedingMigration ?? []) {
      const legacyQuestions = questionsByJob.get(job.id) ?? [];

      if (legacyQuestions.length === 0 || !isJsonColumnEmpty(job.chatQuestions)) {
        continue;
      }

      if (dryRun) {
        this.logger.log(
          `[dry-run] Would migrate ${legacyQuestions.length} chat question(s) to job ${job.id}`,
        );
        updatedCount++;
        continue;
      }

      await this.workspaceQueryService.executeRawQuery(
        `UPDATE ${schema}."_job" SET "chatQuestions" = $2::jsonb WHERE id = $1`,
        [job.id, JSON.stringify(legacyQuestions)],
        workspaceId,
      );
      updatedCount++;
    }

    return updatedCount;
  }

  private async migrateCandidateOtherFields(
    schema: string,
    workspaceId: string,
    batchSize: number,
    dryRun: boolean,
  ): Promise<number> {
    const legacyRows = (await this.workspaceQueryService.executeRawQuery(
      `
        SELECT
          cfv."candidateId" as "candidateId",
          cf.name as "fieldName",
          cfv.name::text as value
        FROM ${schema}."_candidateFieldValue" cfv
        INNER JOIN ${schema}."_candidateField" cf ON cf.id = cfv."candidateFieldsId"
        WHERE cfv."deletedAt" IS NULL
          AND cf."deletedAt" IS NULL
          AND cf.name IS NOT NULL
          AND btrim(cf.name::text) <> ''
          AND cfv.name IS NOT NULL
          AND btrim(cfv.name::text) <> ''
      `,
      [],
      workspaceId,
    )) as LegacyFieldValueRow[];

    const rowsByCandidate = new Map<string, LegacyFieldValueRow[]>();

    for (const row of legacyRows ?? []) {
      if (!row.candidateId || !row.fieldName) {
        continue;
      }

      const existing = rowsByCandidate.get(row.candidateId) ?? [];
      existing.push(row);
      rowsByCandidate.set(row.candidateId, existing);
    }

    if (rowsByCandidate.size === 0) {
      return 0;
    }

    const candidateIds = Array.from(rowsByCandidate.keys());
    let updatedCount = 0;

    for (let index = 0; index < candidateIds.length; index += batchSize) {
      const batchIds = candidateIds.slice(index, index + batchSize);
      const candidates = (await this.workspaceQueryService.executeRawQuery(
        `
          SELECT c.id, c."otherFields"
          FROM ${schema}."_candidate" c
          WHERE c."deletedAt" IS NULL
            AND c.id = ANY($1::uuid[])
        `,
        [batchIds],
        workspaceId,
      )) as { id: string; otherFields: unknown }[];

      for (const candidate of candidates ?? []) {
        const legacyCandidateRows = rowsByCandidate.get(candidate.id) ?? [];
        const legacyOtherFields = buildOtherFieldsFromLegacyRows(
          legacyCandidateRows.map((row) => ({
            fieldName: row.fieldName,
            value: row.value,
          })),
        );

        if (Object.keys(legacyOtherFields).length === 0) {
          continue;
        }

        const mergedOtherFields: OtherFieldsRecord = isJsonColumnEmpty(
          candidate.otherFields,
        )
          ? legacyOtherFields
          : mergeOtherFields(candidate.otherFields, legacyOtherFields);

        if (dryRun) {
          this.logger.log(
            `[dry-run] Would migrate ${Object.keys(legacyOtherFields).length} field(s) to candidate ${candidate.id}`,
          );
          updatedCount++;
          continue;
        }

        await this.workspaceQueryService.executeRawQuery(
          `UPDATE ${schema}."_candidate" SET "otherFields" = $2::jsonb WHERE id = $1`,
          [candidate.id, JSON.stringify(mergedOtherFields)],
          workspaceId,
        );
        updatedCount++;
      }
    }

    return updatedCount;
  }

  private async deleteLegacyRows(
    schema: string,
    workspaceId: string,
  ): Promise<{ fieldValuesDeleted: number; fieldsDeleted: number }> {
    const deletedFieldValues = (await this.workspaceQueryService.executeRawQuery(
      `
        WITH deleted AS (
          DELETE FROM ${schema}."_candidateFieldValue"
          WHERE "deletedAt" IS NULL
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM deleted
      `,
      [],
      workspaceId,
    )) as { count: string }[];

    const deletedFields = (await this.workspaceQueryService.executeRawQuery(
      `
        WITH deleted AS (
          DELETE FROM ${schema}."_candidateField"
          WHERE "deletedAt" IS NULL
          RETURNING id
        )
        SELECT COUNT(*)::text as count FROM deleted
      `,
      [],
      workspaceId,
    )) as { count: string }[];

    return {
      fieldValuesDeleted: Number(deletedFieldValues?.[0]?.count ?? 0),
      fieldsDeleted: Number(deletedFields?.[0]?.count ?? 0),
    };
  }
}
