import {
  normalizeGtmIcpSpec,
  parseGtmIcpSpec,
  resolveEffectiveGtmIcp,
  resolveInheritedTextField,
  stringifyGtmIcpSpec,
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
      buyerTitles: ['VP People'],
      geos: ['US'],
      industries: ['HR Tech'],
    });

    const effective = resolveEffectiveGtmIcp({
      project: { icpSpec: null },
      workspaceProfile: { icpSpec: workspaceIcp },
    });

    expect(effective.isIcpRunOverride).toBe(false);
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

    const effective = resolveEffectiveGtmIcp({
      project: { icpSpec: projectIcp },
      workspaceProfile: {
        icpSpec: JSON.stringify({
          buyerTitles: ['VP People'],
          locations: ['US'],
        }),
      },
    });

    expect(effective.isIcpRunOverride).toBe(true);
    expect(effective.parsedIcp).toEqual({
      buyerTitles: ['Head of Talent'],
      locations: ['UK'],
    });
  });

  it('parses icpSpec, migrates geos, and drops leftover keys', () => {
    expect(parseGtmIcpSpec('not-json')).toBeNull();
    expect(
      normalizeGtmIcpSpec({
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
      stringifyGtmIcpSpec({
        buyerTitles: ['CEO'],
        locations: ['India'],
      }),
    ).toBe(JSON.stringify({ buyerTitles: ['CEO'], locations: ['India'] }));
  });
});
