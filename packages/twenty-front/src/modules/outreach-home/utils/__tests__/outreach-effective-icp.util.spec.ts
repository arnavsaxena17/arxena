import {
  normalizeIcpSpec,
  parseIcpSpec,
  resolveEffectiveIcp,
  resolveInheritedTextField,
  stringifyIcpSpec,
} from '@/outreach-home/utils/outreach-effective-icp.util';

describe('outreach-effective-icp.util', () => {
  it('prefers non-empty project values as project overrides', () => {
    expect(
      resolveInheritedTextField('project-value', 'workspace-value'),
    ).toEqual({
      value: 'project-value',
      isProjectOverride: true,
    });

    expect(resolveInheritedTextField('', 'workspace-value')).toEqual({
      value: 'workspace-value',
      isProjectOverride: false,
    });

    expect(resolveInheritedTextField(null, null)).toEqual({
      value: null,
      isProjectOverride: false,
    });
  });

  it('resolves effective ICP from workspace profile when project is empty', () => {
    const workspaceIcp = JSON.stringify({
      buyerTitles: ['VP People'],
      geos: ['US'],
      industries: ['HR Tech'],
    });

    const effective = resolveEffectiveIcp({
      project: { icpSpec: null },
      workspaceProfile: { icpSpec: workspaceIcp },
    });

    expect(effective.isIcpProjectOverride).toBe(false);
    expect(effective.parsedIcp).toEqual({
      buyerTitles: ['VP People'],
      locations: ['US'],
    });
    expect(JSON.parse(effective.icpSpec ?? '{}')).toEqual({
      buyerTitles: ['VP People'],
      locations: ['US'],
    });
  });

  it('uses project ICP when set', () => {
    const projectIcp = JSON.stringify({
      buyerTitles: ['Head of Talent'],
      locations: ['UK'],
    });

    const effective = resolveEffectiveIcp({
      project: { icpSpec: projectIcp },
      workspaceProfile: {
        icpSpec: JSON.stringify({
          buyerTitles: ['VP People'],
          locations: ['US'],
        }),
      },
    });

    expect(effective.isIcpProjectOverride).toBe(true);
    expect(effective.parsedIcp).toEqual({
      buyerTitles: ['Head of Talent'],
      locations: ['UK'],
    });
  });

  it('parses icpSpec, migrates geos, and drops leftover keys', () => {
    expect(parseIcpSpec('not-json')).toBeNull();
    expect(
      normalizeIcpSpec({
        buyerTitles: ['CEO'],
        geos: ['India'],
        locations: ['Singapore'],
        name: 'ignored',
      }),
    ).toEqual({
      buyerTitles: ['CEO'],
      locations: ['Singapore', 'India'],
    });
    expect(
      stringifyIcpSpec({
        buyerTitles: ['CEO'],
        locations: ['India'],
      }),
    ).toBe(JSON.stringify({ buyerTitles: ['CEO'], locations: ['India'] }));
  });
});
