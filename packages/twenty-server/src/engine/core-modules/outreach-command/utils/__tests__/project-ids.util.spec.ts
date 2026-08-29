import {
  appendProjectId,
  projectIdsHasProject,
  parseProjectIds,
} from '../project-ids.util';

describe('project-ids.util', () => {
  it('parses text and arrays', () => {
    expect(parseProjectIds('project-1')).toEqual(['project-1']);
    expect(parseProjectIds(['project-1', 'project-1', 'project-2'])).toEqual([
      'project-1',
      'project-2',
    ]);
    expect(parseProjectIds('["a","b"]')).toEqual(['a', 'b']);
    expect(
      parseProjectIds('{84a08312-0e86-59ed-8103-f575c3f17812}'),
    ).toEqual(['84a08312-0e86-59ed-8103-f575c3f17812']);
  });

  it('appends without duplicating', () => {
    expect(appendProjectId(null, 'p1')).toEqual(['p1']);
    expect(appendProjectId('p1', 'p1')).toEqual(['p1']);
    expect(appendProjectId(['p1'], 'p2')).toEqual(['p1', 'p2']);
    expect(projectIdsHasProject(['p1', 'p2'], 'p2')).toBe(true);
  });
});
