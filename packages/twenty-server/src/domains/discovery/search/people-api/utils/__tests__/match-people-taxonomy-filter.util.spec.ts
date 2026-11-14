import {
  findStdFunctionCatalogMatch,
  listStdFunctionItemsForRoot,
  matchStdFunctionRoot,
  matchStdGrade,
} from '../match-people-taxonomy-filter.util';

describe('matchStdGrade', () => {
  it('should accept canonical grade values', () => {
    expect(matchStdGrade('leadership')).toBe('leadership');
    expect(matchStdGrade('Mid')).toBe('mid');
  });

  it('should reject unknown grades', () => {
    expect(matchStdGrade('manager')).toBeUndefined();
  });
});

describe('matchStdFunctionRoot', () => {
  it('should accept canonical function roots', () => {
    expect(matchStdFunctionRoot('engineering')).toBe('engineering');
    expect(matchStdFunctionRoot('Human Resources')).toBe('human resources');
  });

  it('should reject unknown function roots', () => {
    expect(matchStdFunctionRoot('software engineering')).toBeUndefined();
  });
});

describe('findStdFunctionCatalogMatch', () => {
  const catalog = [
    {
      id: 'software engineering',
      label: 'software engineering',
      name: 'software engineering',
    },
    {
      id: 'talent acquisition',
      label: 'Talent Acquisition',
      name: 'talent acquisition',
    },
  ];

  it('should match id, label, or name case-insensitively', () => {
    expect(
      findStdFunctionCatalogMatch('Software Engineering', catalog)?.id,
    ).toBe('software engineering');
    expect(
      findStdFunctionCatalogMatch('talent acquisition', catalog)?.id,
    ).toBe('talent acquisition');
  });

  it('should return undefined for unknown functions', () => {
    expect(
      findStdFunctionCatalogMatch('not a function', catalog),
    ).toBeUndefined();
  });
});

describe('listStdFunctionItemsForRoot', () => {
  const catalog = [
    {
      id: 'software engineering',
      label: 'software engineering',
      name: 'software engineering',
      parent_id: 'engineering',
    },
    {
      id: 'data science',
      label: 'data science',
      name: 'data science',
      parent_id: 'engineering',
    },
    {
      id: 'talent acquisition',
      label: 'talent acquisition',
      name: 'talent acquisition',
      parent_id: 'human resources',
    },
  ];

  it('should return child functions for a function root', () => {
    expect(listStdFunctionItemsForRoot(catalog, 'engineering')).toEqual([
      { id: 'data science', label: 'data science' },
      { id: 'software engineering', label: 'software engineering' },
    ]);
  });

  it('should return the full catalog when no root is given', () => {
    expect(listStdFunctionItemsForRoot(catalog)).toHaveLength(3);
  });
});
