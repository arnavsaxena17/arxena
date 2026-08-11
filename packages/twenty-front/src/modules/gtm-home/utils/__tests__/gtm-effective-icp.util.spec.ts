import {
  parseGtmIcpSpec,
  resolveEffectiveGtmIcp,
  resolveInheritedTextField,
  toGtmIcpSet,
} from '@/gtm-home/utils/gtm-effective-icp.util';

describe('gtm-effective-icp.util', () => {
  it('prefers non-empty project values as run overrides', () => {
    expect(
      resolveInheritedTextField('project-value', 'workspace-value'),
    ).toEqual({
      value: 'project-value',
      isRunOverride: true,
    });

    expect(resolveInheritedTextField('', 'workspace-value')).toEqual({
      value: 'workspace-value',
      isRunOverride: false,
    });

    expect(resolveInheritedTextField(null, null)).toEqual({
      value: null,
      isRunOverride: false,
    });
  });

  it('resolves effective ICP from workspace profile when project is empty', () => {
    const workspaceIcp = JSON.stringify({
      name: 'Workspace buyers',
      industries: ['HR Tech'],
      employeeRange: '50-200',
      geos: ['US'],
      buyerTitles: ['VP People'],
      painSignals: ['capacity'],
      stdFunctions: ['people'],
      stdGrades: ['vp'],
    });

    const effective = resolveEffectiveGtmIcp({
      project: {
        icpSpec: null,
        icpSegment: null,
        icpBlurb: null,
        companySearchBlurb: null,
        peopleSearchBlurb: null,
      },
      workspaceProfile: {
        icpSpec: workspaceIcp,
        icpSegment: 'Workspace buyers',
        icpBlurb: 'Sell to HR Tech talent leaders.',
        companySearchBlurb: 'Find HR Tech cos',
        peopleSearchBlurb: 'Find VPs',
      },
    });

    expect(effective.isIcpRunOverride).toBe(false);
    expect(effective.icpSegment).toBe('Workspace buyers');
    expect(effective.parsedIcp?.name).toBe('Workspace buyers');
    expect(effective.icpBlurb).toBe('Sell to HR Tech talent leaders.');
    expect(effective.companySearchBlurb).toBe('Find HR Tech cos');
  });

  it('uses project ICP when set', () => {
    const projectIcp = JSON.stringify({ name: 'Run buyers' });

    const effective = resolveEffectiveGtmIcp({
      project: {
        icpSpec: projectIcp,
        icpSegment: 'Run buyers',
        icpBlurb: 'Run-specific ICP blurb',
        companySearchBlurb: 'Run companies',
        peopleSearchBlurb: null,
      },
      workspaceProfile: {
        icpSpec: JSON.stringify({ name: 'Workspace buyers' }),
        icpSegment: 'Workspace buyers',
        icpBlurb: 'Workspace ICP blurb',
        companySearchBlurb: 'Workspace companies',
        peopleSearchBlurb: 'Workspace people',
      },
    });

    expect(effective.isIcpRunOverride).toBe(true);
    expect(effective.isIcpBlurbRunOverride).toBe(true);
    expect(effective.icpSegment).toBe('Run buyers');
    expect(effective.icpBlurb).toBe('Run-specific ICP blurb');
    expect(effective.companySearchBlurb).toBe('Run companies');
    expect(effective.isPeopleSearchBlurbRunOverride).toBe(false);
    expect(effective.peopleSearchBlurb).toBe('Workspace people');
  });

  it('parses icpSpec and maps to GtmIcpSet', () => {
    expect(parseGtmIcpSpec('not-json')).toBeNull();
    expect(toGtmIcpSet(null, null)).toBeNull();

    const set = toGtmIcpSet(
      {
        name: 'Buyers',
        industries: ['SaaS'],
        employeeRange: '10-50',
        geos: [],
        buyerTitles: [],
        painSignals: [],
      },
      'Fallback',
    );

    expect(set?.name).toBe('Buyers');
    expect(set?.industries).toEqual(['SaaS']);
  });
});
