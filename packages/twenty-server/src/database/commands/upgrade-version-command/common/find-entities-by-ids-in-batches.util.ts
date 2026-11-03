import chunk from 'lodash.chunk';

const DEFAULT_FIND_BATCH_SIZE = 1000;

// Loads every row for the given ids using a bounded number of queries instead
// of one round-trip per id, and returns them keyed by id. Upgrade backfills that
// resolve thousands of related records were issuing one findOne per id, which
// made their runtime network-bound on large workspaces.
export const findEntitiesByIdInBatches = async <TEntity extends { id: string }>(
  findByIds: (ids: string[]) => Promise<TEntity[]>,
  ids: string[],
  batchSize = DEFAULT_FIND_BATCH_SIZE,
): Promise<Map<string, TEntity>> => {
  const entitiesById = new Map<string, TEntity>();

  for (const idBatch of chunk(ids, batchSize)) {
    for (const entity of await findByIds(idBatch)) {
      entitiesById.set(entity.id, entity);
    }
  }

  return entitiesById;
};
