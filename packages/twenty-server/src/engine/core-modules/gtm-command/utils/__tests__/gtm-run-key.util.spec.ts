import {
  appendGtmRunKey,
  gtmRunKeyHasProject,
  parseGtmRunKeys,
} from '../gtm-run-key.util';

describe('gtm-run-key.util', () => {
  it('parses legacy text and arrays', () => {
    expect(parseGtmRunKeys('project-1')).toEqual(['project-1']);
    expect(parseGtmRunKeys(['project-1', 'project-1', 'project-2'])).toEqual([
      'project-1',
      'project-2',
    ]);
    expect(parseGtmRunKeys('["a","b"]')).toEqual(['a', 'b']);
    expect(
      parseGtmRunKeys('{84a08312-0e86-59ed-8103-f575c3f17812}'),
    ).toEqual(['84a08312-0e86-59ed-8103-f575c3f17812']);
  });

  it('appends without duplicating', () => {
    expect(appendGtmRunKey(null, 'p1')).toEqual(['p1']);
    expect(appendGtmRunKey('p1', 'p1')).toEqual(['p1']);
    expect(appendGtmRunKey(['p1'], 'p2')).toEqual(['p1', 'p2']);
    expect(gtmRunKeyHasProject(['p1', 'p2'], 'p2')).toBe(true);
  });
});
