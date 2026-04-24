import type { OrgChartNodeData } from 'twenty-shared';

import {
  isOutreachEmailContextVisible,
  isOutreachGoogleContactContextVisible,
  isOutreachLinkedInContextVisible,
  isOutreachWhatsappContextVisible,
  orgChartFirstSlotWithEmail,
  orgChartFirstSlotWithLinkedin,
  orgChartFirstSlotWithPhone,
  orgChartFirstSlotWithPhoneAndEmail,
  orgChartNodeHasGoogleContactFields,
  orgChartNodeHasOutreachEmail,
  orgChartNodeHasOutreachLinkedin,
  orgChartNodeHasOutreachPhone,
} from 'twenty-shared';

const activeBase = {
  key: 1,
  headline: '',
  nodeState: 'active' as const,
};

describe('orgChartOutreachVisibility (from twenty-shared)', () => {
  it('orgChartNodeHasOutreachLinkedin: false for null and invalid urls', () => {
    console.log('linkedin visibility: null');
    expect(orgChartNodeHasOutreachLinkedin(null)).toBe(false);
    const noUrl = { ...activeBase } as OrgChartNodeData;
    console.log('linkedin visibility: no url', noUrl);
    expect(orgChartNodeHasOutreachLinkedin(noUrl)).toBe(false);
  });

  it('orgChartNodeHasOutreachLinkedin: true when valid linkedin_url_i', () => {
    const node = {
      ...activeBase,
      linkedin_url_1: 'https://www.linkedin.com/in/someone',
    } as OrgChartNodeData;
    console.log('linkedin visibility: valid', node);
    expect(orgChartNodeHasOutreachLinkedin(node)).toBe(true);
    expect(orgChartFirstSlotWithLinkedin(node)).toBe(1);
  });

  it('orgChartFirstSlotWithLinkedin returns 0 when none', () => {
    const node = { ...activeBase } as OrgChartNodeData;
    console.log('linkedin first slot empty', orgChartFirstSlotWithLinkedin(node));
    expect(orgChartFirstSlotWithLinkedin(node)).toBe(0);
  });

  it('phone and email slot helpers', () => {
    expect(orgChartNodeHasOutreachPhone(null)).toBe(false);
    expect(orgChartNodeHasOutreachEmail(null)).toBe(false);
    const phoneOnly = {
      ...activeBase,
      phone_2: ' +1 555 ',
    } as OrgChartNodeData;
    console.log('phone only', phoneOnly);
    expect(orgChartNodeHasOutreachPhone(phoneOnly)).toBe(true);
    expect(orgChartFirstSlotWithPhone(phoneOnly)).toBe(2);
    expect(orgChartNodeHasOutreachEmail(phoneOnly)).toBe(false);
    expect(orgChartFirstSlotWithEmail(phoneOnly)).toBe(0);

    const both = {
      ...activeBase,
      phone_0: '1',
      email_0: 'a@b.co',
    } as OrgChartNodeData;
    expect(orgChartNodeHasGoogleContactFields(both)).toBe(true);
    expect(orgChartFirstSlotWithPhoneAndEmail(both)).toBe(0);
  });

  it('orgChartFirstSlotWithPhoneAndEmail returns 0 when no shared slot', () => {
    const split = {
      ...activeBase,
      phone_0: '1',
      email_1: 'x@y.z',
    } as OrgChartNodeData;
    console.log('split slots', orgChartFirstSlotWithPhoneAndEmail(split));
    expect(orgChartFirstSlotWithPhoneAndEmail(split)).toBe(0);
  });

  it('context visibility requires active nodeState', () => {
    const withFields = {
      key: 2,
      headline: '',
      nodeState: 'preview' as const,
      linkedin_url_0: 'https://www.linkedin.com/in/x',
      phone_0: '1',
      email_0: 'e@e.e',
    } satisfies OrgChartNodeData;
    console.log('preview node outreach flags');
    expect(isOutreachLinkedInContextVisible(withFields)).toBe(false);
    expect(isOutreachWhatsappContextVisible(withFields)).toBe(false);
    expect(isOutreachGoogleContactContextVisible(withFields)).toBe(false);
    expect(isOutreachEmailContextVisible(withFields)).toBe(false);

    const active = { ...withFields, nodeState: 'active' as const };
    console.log('active node outreach flags');
    expect(isOutreachLinkedInContextVisible(active)).toBe(true);
    expect(isOutreachWhatsappContextVisible(active)).toBe(true);
    expect(isOutreachGoogleContactContextVisible(active)).toBe(true);
    expect(isOutreachEmailContextVisible(active)).toBe(true);
  });

  it('isOutreachGoogleContactContextVisible false without both phone and email', () => {
    const active = {
      ...activeBase,
      phone_0: '1',
    } as OrgChartNodeData;
    expect(isOutreachGoogleContactContextVisible(active)).toBe(false);
  });
});
