import {
  canPersistDataTableFilters,
  clearPersistedTableFilters,
  isBackendBackedDataTableProjectId,
  loadPersistedTableFilters,
  mapPersistedFiltersToColumnIndexes,
  savePersistedTableFilters,
} from '../persist-table-filters';

describe('persist-table-filters', () => {
  const storageKey = 'candidate-table-filters:outreach-people-proj-1';

  beforeEach(() => {
    localStorage.clear();
  });

  it('should allow localStorage persistence for outreach people table ids', () => {
    expect(canPersistDataTableFilters('outreach-people-proj-1')).toBe(true);
    expect(isBackendBackedDataTableProjectId('outreach-people-proj-1')).toBe(
      false,
    );
  });

  it('should save and restore filters for outreach people table ids', () => {
    savePersistedTableFilters(
      'outreach-people-proj-1',
      [
        {
          column: 0,
          conditions: [{ name: 'eq', args: ['Queued'] }],
          operation: 'conjunction',
        },
      ],
      [{ data: 'outreachSequenceStage' }],
    );

    expect(localStorage.getItem(storageKey)).toContain('outreachSequenceStage');

    const restored = mapPersistedFiltersToColumnIndexes(
      loadPersistedTableFilters('outreach-people-proj-1'),
      [{ data: 'outreachSequenceStage' }, { data: 'name' }],
    );

    expect(restored).toEqual([
      {
        column: 0,
        conditions: [{ name: 'eq', args: ['Queued'] }],
        operation: 'conjunction',
      },
    ]);

    clearPersistedTableFilters('outreach-people-proj-1');
    expect(loadPersistedTableFilters('outreach-people-proj-1')).toEqual([]);
  });
});
