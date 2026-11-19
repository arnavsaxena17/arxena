import {
  describeTabWrite,
  toTabWriteCounts,
} from 'src/engine/core-modules/tool/utils/describe-tab-write.util';

describe('toTabWriteCounts', () => {
  it('should map created rows to newRows and merged rows to alreadyOnTab', () => {
    expect(toTabWriteCounts({ createdCount: 3, updatedCount: 4 })).toEqual({
      newRows: 3,
      alreadyOnTab: 4,
    });
  });
});

describe('describeTabWrite', () => {
  it('should say no one new was found when every row was already on the tab', () => {
    const sentence = describeTabWrite(
      { newRows: 0, alreadyOnTab: 4 },
      'people',
    );

    expect(sentence).toContain('0 new people');
    expect(sentence).toContain('all 4 rows were already there');
    expect(sentence).toContain('found no one new');
  });

  it('should give both counts when some rows are new', () => {
    expect(describeTabWrite({ newRows: 1, alreadyOnTab: 2 }, 'companies')).toBe(
      '1 new row added to the companies tab; 2 rows were already there. Report newRows, not the tab total.',
    );
  });

  it('should say nothing was written when both counts are zero', () => {
    expect(describeTabWrite({ newRows: 0, alreadyOnTab: 0 }, 'people')).toBe(
      'Nothing was written to the people tab.',
    );
  });
});
