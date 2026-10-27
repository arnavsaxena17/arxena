import {
  buildHarvestSearchQuery,
  compactHarvestSearchItem,
  getHarvestNextPage,
  splitHarvestTitleList,
} from 'src/engine/core-modules/org-chart/utils/harvest-search-params.util';

describe('buildHarvestSearchQuery', () => {
  it('should join lists with commas and drop unknown keys', () => {
    expect(
      buildHarvestSearchQuery('leads', {
        currentJobTitles: ['Plant Manager', 'Factory Manager'],
        locations: ['Mumbai'],
        recentlyChangedJobs: true,
        role: { include: ['14'] },
      }),
    ).toEqual({
      query: {
        currentJobTitles: 'Plant Manager,Factory Manager',
        locations: 'Mumbai',
        recentlyChangedJobs: 'true',
      },
      ignored: ['role'],
    });
  });

  it('should reject lead filters on an account search', () => {
    expect(
      buildHarvestSearchQuery('accounts', {
        currentJobTitles: ['CEO'],
        companyHeadcount: ['51-200', '201-500'],
      }),
    ).toEqual({
      query: { companyHeadcount: '51-200,201-500' },
      ignored: ['currentJobTitles'],
    });
  });

  it('should skip empty and false values', () => {
    expect(
      buildHarvestSearchQuery('leads', {
        search: '  ',
        locations: [],
        postedOnLinkedin: false,
      }).query,
    ).toEqual({});
  });
});

describe('splitHarvestTitleList', () => {
  it('should split a plain OR list of titles', () => {
    expect(
      splitHarvestTitleList('("Plant Manager" OR "Factory Manager" OR Plant Manager)'),
    ).toEqual(['Plant Manager', 'Factory Manager']);
  });

  it('should keep a single title', () => {
    expect(splitHarvestTitleList('Head of Engineering')).toEqual([
      'Head of Engineering',
    ]);
  });

  it('should refuse a factored boolean expression', () => {
    expect(
      splitHarvestTitleList('"Engineering" AND (Head OR VP OR Director)'),
    ).toBeNull();
  });
});

describe('getHarvestNextPage', () => {
  it('should stop on the last page, an empty page or page 100', () => {
    expect(getHarvestNextPage(1, 4, 25)).toBe(2);
    expect(getHarvestNextPage(4, 4, 25)).toBeNull();
    expect(getHarvestNextPage(2, undefined, 0)).toBeNull();
    expect(getHarvestNextPage(100, 400, 25)).toBeNull();
  });
});

describe('compactHarvestSearchItem', () => {
  it('should keep the lead fields lists use', () => {
    expect(
      compactHarvestSearchItem('leads', {
        id: 'ACw1',
        linkedinUrl: 'https://www.linkedin.com/in/asha',
        firstName: 'Asha',
        lastName: 'Rao',
        pictureUrl: 'https://media.licdn.com/x.jpg',
        location: { linkedinText: 'Mumbai, India' },
        currentPositions: [
          { title: 'Plant Manager', companyName: 'Arvind', description: 'Long' },
        ],
      }),
    ).toEqual({
      id: 'ACw1',
      linkedinUrl: 'https://www.linkedin.com/in/asha',
      firstName: 'Asha',
      lastName: 'Rao',
      location: 'Mumbai, India',
      currentPositions: [{ title: 'Plant Manager', companyName: 'Arvind' }],
    });
  });

  it('should shorten account descriptions and keep highlight labels', () => {
    const compacted = compactHarvestSearchItem('accounts', {
      id: '1035',
      name: 'Microsoft',
      logoUrl: 'https://media.licdn.com/logo.png',
      description: 'x'.repeat(900),
      employeeCountRange: '10001+',
      highlights: [{ id: 'HIRING_ON_LINKEDIN', label: 'Hiring on Linkedin' }],
    });

    expect(compacted).toMatchObject({
      id: '1035',
      name: 'Microsoft',
      employeeCountRange: '10001+',
      highlights: ['Hiring on Linkedin'],
    });
    expect(compacted).not.toHaveProperty('logoUrl');
    expect(String(compacted.description)).toHaveLength(500);
  });
});
