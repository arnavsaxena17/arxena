import { type DataSource } from 'typeorm';

import { type WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const COMPANY_TABLE_NAME = 'company';
const LINKEDIN_ID_COLUMN = 'linkedinId';
const UNIQUE_INDEX_NAME = 'IDX_UNIQUE_company_linkedinId';

type ApplyUniqueCompanyLinkedinIdLogger = {
  log: (message: string) => void;
};

// Apply uniqueness via workspace SQL. Do not use Arxena manifest.indexes on
// Twenty standard Company — that object is not in the Arxena flat object maps
// and throws "Index references unknown object".
export const applyUniqueCompanyLinkedinId = async ({
  coreDataSource,
  workspaceQueryService,
  schemaName,
  workspaceId,
  logger,
}: {
  coreDataSource: DataSource;
  workspaceQueryService: WorkspaceQueryService;
  schemaName: string;
  workspaceId: string;
  logger: ApplyUniqueCompanyLinkedinIdLogger;
}): Promise<void> => {
  const tableExists = await workspaceQueryService.checkIfTableExists(
    schemaName,
    COMPANY_TABLE_NAME,
  );

  if (!tableExists) {
    logger.log(
      `Workspace ${workspaceId}: ${COMPANY_TABLE_NAME} missing; skip unique linkedinId`,
    );

    return;
  }

  const columnExists = await workspaceQueryService.checkIfColumnExists(
    schemaName,
    COMPANY_TABLE_NAME,
    LINKEDIN_ID_COLUMN,
    { silent: true },
  );

  if (!columnExists) {
    logger.log(
      `Workspace ${workspaceId}: ${COMPANY_TABLE_NAME}.${LINKEDIN_ID_COLUMN} missing; skip`,
    );

    return;
  }

  // Empty string is not NULL — unique indexes treat '' as a real value.
  const emptyNulled = (await coreDataSource.query(
    `
      UPDATE "${schemaName}"."${COMPANY_TABLE_NAME}"
      SET "${LINKEDIN_ID_COLUMN}" = NULL, "updatedAt" = NOW()
      WHERE "deletedAt" IS NULL
        AND "${LINKEDIN_ID_COLUMN}" IS NOT NULL
        AND btrim("${LINKEDIN_ID_COLUMN}") = ''
      RETURNING id
    `,
  )) as Array<{ id: string }>;

  // Keep the oldest row per linkedinId; null the rest so the unique index can apply.
  const duplicatesNulled = (await coreDataSource.query(
    `
      UPDATE "${schemaName}"."${COMPANY_TABLE_NAME}" AS company
      SET "${LINKEDIN_ID_COLUMN}" = NULL, "updatedAt" = NOW()
      FROM (
        SELECT id
        FROM (
          SELECT
            id,
            row_number() OVER (
              PARTITION BY btrim("${LINKEDIN_ID_COLUMN}")
              ORDER BY "createdAt" ASC NULLS LAST, id ASC
            ) AS row_number
          FROM "${schemaName}"."${COMPANY_TABLE_NAME}"
          WHERE "deletedAt" IS NULL
            AND "${LINKEDIN_ID_COLUMN}" IS NOT NULL
            AND btrim("${LINKEDIN_ID_COLUMN}") <> ''
        ) ranked
        WHERE ranked.row_number > 1
      ) duplicates
      WHERE company.id = duplicates.id
      RETURNING company.id
    `,
  )) as Array<{ id: string }>;

  const existingUniqueIndexes = (await coreDataSource.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = $1
        AND tablename = $2
        AND indexdef ILIKE '%"linkedinId"%'
        AND indexdef ILIKE '%UNIQUE%'
    `,
    [schemaName, COMPANY_TABLE_NAME],
  )) as Array<{ indexname: string }>;

  if (existingUniqueIndexes.length === 0) {
    await coreDataSource.query(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS "${UNIQUE_INDEX_NAME}"
        ON "${schemaName}"."${COMPANY_TABLE_NAME}" ("${LINKEDIN_ID_COLUMN}")
      `,
    );
  }

  logger.log(
    `Workspace ${workspaceId}: unique company.linkedinId ready (emptyNulled=${emptyNulled.length}, duplicatesNulled=${duplicatesNulled.length}, existingIndexes=${existingUniqueIndexes.length})`,
  );
};
