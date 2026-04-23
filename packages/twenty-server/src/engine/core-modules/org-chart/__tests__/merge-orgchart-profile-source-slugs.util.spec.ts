import {
  applyApolloOnlyNodeLockState,
  assignApolloPublicSlugToAllPersonSlots,
  backfillUnmappedLinkedInSlotsWithApolloSlug,
  mergeContactAvailabilityOntoOrgChartData,
  mergeContactAvailabilityOntoOrgChartDataByPersonId,
  mergeProfileSourceSlugsOntoOrgChartData,
  ORGCHART_DATA_SOURCE_SLUG_APOLLO,
} from 'src/engine/core-modules/org-chart/utils/merge-orgchart-profile-source-slugs.util';
import type { OrgChartData } from 'twenty-shared';

describe('assignApolloPublicSlugToAllPersonSlots', () => {
  it('sets every person slot ds_i to the Apollo slug without a URL→slug map', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'Team',
          name_0: 'Pat',
          name_1: 'Alex',
        },
      ],
    };
    const out = assignApolloPublicSlugToAllPersonSlots(
      data,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const node = (out.orgchart as object[])[0] as Record<string, string>;
    expect(node.ds_0).toBe(ORGCHART_DATA_SOURCE_SLUG_APOLLO);
    expect(node.ds_1).toBe(ORGCHART_DATA_SOURCE_SLUG_APOLLO);
  });
});

describe('mergeProfileSourceSlugsOntoOrgChartData', () => {
  it('adds ds_i from linkedin_url_i and urlToSlug', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: 'https://www.linkedin.com/in/abc',
          name_0: 'A',
        },
      ],
    };
    const urlToSlug = new Map([
      [
        'https://www.linkedin.com/in/abc'.toLowerCase().replace(/\/+$/, ''),
        'm7kq',
      ],
    ]);
    const out = mergeProfileSourceSlugsOntoOrgChartData(data, urlToSlug);
    const node = (out.orgchart as object[])[0] as Record<string, string>;
    expect(node.ds_0).toBe('m7kq');
  });

  it('is a no-op when the map is empty', () => {
    const data: OrgChartData = { orgchart: [] };
    expect(mergeProfileSourceSlugsOntoOrgChartData(data, new Map())).toEqual(
      data,
    );
  });
});

describe('mergeContactAvailabilityOntoOrgChartData', () => {
  it('adds has_email_i / has_direct_phone_i / has_org_phone_i from url map', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: 'https://www.linkedin.com/in/abc',
          name_0: 'A',
        },
      ],
    };
    const u =
      'https://www.linkedin.com/in/abc'.toLowerCase().replace(/\/+$/, '');
    const urlToContact = new Map([
      [
        u,
        {
          hasEmail: true,
          hasDirectPhone: true,
          hasOrgPhone: true,
        },
      ],
    ]);
    const out = mergeContactAvailabilityOntoOrgChartData(data, urlToContact);
    const node = (out.orgchart as object[])[0] as Record<string, boolean>;
    expect(node.has_email_0).toBe(true);
    expect(node.has_direct_phone_0).toBe(true);
    expect(node.has_org_phone_0).toBe(true);
  });
});

describe('mergeContactAvailabilityOntoOrgChartDataByPersonId', () => {
  it('merges has_email / phone flags by candidates[i].id when URL is empty', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'Team',
          linkedin_url_0: '',
          name_0: 'Test',
          candidates: [{ id: 'apollo-person-1', full_name: 'Test' }],
        },
      ],
    };
    const personIdToContact = new Map([
      [
        'apollo-person-1',
        {
          hasEmail: true,
          hasDirectPhone: true,
          hasOrgPhone: false,
        },
      ],
    ]);
    const out = mergeContactAvailabilityOntoOrgChartDataByPersonId(
      data,
      personIdToContact,
    );
    const node = (out.orgchart as object[])[0] as Record<string, boolean | undefined>;
    expect(node.has_email_0).toBe(true);
    expect(node.has_direct_phone_0).toBe(true);
    expect(node.has_org_phone_0).toBe(false);
  });
});

describe('backfillUnmappedLinkedInSlotsWithApolloSlug', () => {
  it('sets ds_i when missing so applyApolloOnlyNodeLockState can run', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: 'https://www.linkedin.com/in/person',
          name_0: 'A',
        },
      ],
    };
    const filled = backfillUnmappedLinkedInSlotsWithApolloSlug(
      data,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const locked = applyApolloOnlyNodeLockState(
      filled,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const node = (locked.orgchart as object[])[0] as Record<string, string>;
    expect(node.ds_0).toBe(ORGCHART_DATA_SOURCE_SLUG_APOLLO);
    expect(node.nodeState).toBe('lock');
  });

  it('does not overwrite an existing non-empty ds_i', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: 'https://www.linkedin.com/in/person',
          ds_0: 'h4rj',
        },
      ],
    };
    const out = backfillUnmappedLinkedInSlotsWithApolloSlug(
      data,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const node = (out.orgchart as object[])[0] as Record<string, string>;
    expect(node.ds_0).toBe('h4rj');
  });

  it('sets ds_i when linkedin_url_i is empty but name_i is present (Apollo, no public URL)', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: '',
          name_0: 'Elizabeth',
        },
      ],
    };
    const filled = backfillUnmappedLinkedInSlotsWithApolloSlug(
      data,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const locked = applyApolloOnlyNodeLockState(
      filled,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const node = (locked.orgchart as object[])[0] as Record<string, string>;
    expect(node.ds_0).toBe(ORGCHART_DATA_SOURCE_SLUG_APOLLO);
    expect(node.nodeState).toBe('lock');
  });

  it('sets lock when linkedin_url_i is omitted (Python) but name_i is present', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'Engineering Managers',
          name_0: 'Donnie',
        },
      ],
    };
    const filled = backfillUnmappedLinkedInSlotsWithApolloSlug(
      data,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const locked = applyApolloOnlyNodeLockState(
      filled,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const node = (locked.orgchart as object[])[0] as Record<string, string>;
    expect(node.ds_0).toBe(ORGCHART_DATA_SOURCE_SLUG_APOLLO);
    expect(node.nodeState).toBe('lock');
  });
});

describe('applyApolloOnlyNodeLockState', () => {
  it('sets nodeState lock when every linkedin slot is Apollo-only', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: 'https://www.linkedin.com/in/a',
          ds_0: ORGCHART_DATA_SOURCE_SLUG_APOLLO,
          name_0: 'A',
        },
      ],
    };
    const out = applyApolloOnlyNodeLockState(data, ORGCHART_DATA_SOURCE_SLUG_APOLLO);
    const node = (out.orgchart as object[])[0] as Record<string, string>;
    expect(node.nodeState).toBe('lock');
  });

  it('does not set lock when a slot is not Apollo', () => {
    const data: OrgChartData = {
      type: 'fullcompany',
      orgchart: [
        {
          key: 0,
          headline: 'X',
          linkedin_url_0: 'https://www.linkedin.com/in/a',
          linkedin_url_1: 'https://www.linkedin.com/in/b',
          ds_0: 'm7kq',
          ds_1: 'h4rj',
        },
      ],
    };
    const out = applyApolloOnlyNodeLockState(
      data,
      ORGCHART_DATA_SOURCE_SLUG_APOLLO,
    );
    const node = (out.orgchart as object[])[0] as Record<string, string | undefined>;
    expect(node.nodeState).toBeUndefined();
  });
});
