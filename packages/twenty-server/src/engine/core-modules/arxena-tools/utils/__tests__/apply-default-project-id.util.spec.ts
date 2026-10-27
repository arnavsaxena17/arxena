import { applyDefaultProjectId } from 'src/engine/core-modules/arxena-tools/utils/apply-default-project-id.util';

describe('applyDefaultProjectId', () => {
  it('should fill projectId for a search that writes the project tab', () => {
    expect(
      applyDefaultProjectId(
        'search_apollo_people',
        { personTitles: ['cto'] },
        'project-1',
      ),
    ).toEqual({ personTitles: ['cto'], projectId: 'project-1' });
    expect(
      applyDefaultProjectId(
        'search_bright_data_business',
        { query: 'qsr' },
        'project-1',
      ),
    ).toEqual({ query: 'qsr', projectId: 'project-1' });
  });

  it('should keep a projectId the model passed', () => {
    expect(
      applyDefaultProjectId(
        'search_linkedin_people',
        { projectId: 'project-2' },
        'project-1',
      ),
    ).toEqual({ projectId: 'project-2' });
  });

  it('should leave tools that take projectId as a filter alone', () => {
    const args = { limit: 10 };

    expect(
      applyDefaultProjectId('find_many_candidates', args, 'project-1'),
    ).toBe(args);
  });

  it('should leave args alone when there is no project in context', () => {
    const args = { query: 'qsr' };

    expect(
      applyDefaultProjectId('search_bright_data_business', args, undefined),
    ).toBe(args);
  });
});
