import { findEntitiesByIdInBatches } from 'src/database/commands/upgrade-version-command/common/find-entities-by-ids-in-batches.util';

describe('findEntitiesByIdInBatches', () => {
  it('should return every entity keyed by id across multiple batches', async () => {
    const findByIds = jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ id })),
    );

    const result = await findEntitiesByIdInBatches(
      findByIds,
      ['a', 'b', 'c', 'd', 'e'],
      2,
    );

    expect(findByIds).toHaveBeenCalledTimes(3);
    expect(findByIds).toHaveBeenNthCalledWith(1, ['a', 'b']);
    expect(findByIds).toHaveBeenNthCalledWith(3, ['e']);
    expect([...result.keys()]).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('should not query at all when there are no ids', async () => {
    const findByIds = jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ id })),
    );

    const result = await findEntitiesByIdInBatches(findByIds, []);

    expect(findByIds).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('should drop ids that no row matched', async () => {
    const findByIds = jest.fn(async (ids: string[]) =>
      ids.filter((id) => id !== 'missing').map((id) => ({ id })),
    );

    const result = await findEntitiesByIdInBatches(
      findByIds,
      ['present', 'missing'],
      10,
    );

    expect([...result.keys()]).toEqual(['present']);
  });
});
