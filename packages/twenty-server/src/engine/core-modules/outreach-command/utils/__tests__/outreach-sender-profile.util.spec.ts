import { flattenFatOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/flatten-fat-outreach-sender-profile.util';
import {
  buildSenderProfileSeed,
  normalizeOutreachSenderProfile,
} from 'src/engine/core-modules/outreach-command/utils/outreach-sender-profile.util';

describe('normalizeOutreachSenderProfile', () => {
  it('normalizes slim profiles', () => {
    expect(
      normalizeOutreachSenderProfile({
        targetTitles: ['CFO'],
        locations: ['India'],
        brief: 'Hello',
      }),
    ).toEqual({
      targetTitles: ['CFO'],
      locations: ['India'],
      brief: 'Hello',
      collateralFiles: [],
    });
  });

  it('flattens fat profiles', () => {
    const slim = flattenFatOutreachSenderProfile({
      identity: { full_name: 'Jane', title: 'CEO', company: 'Acme' },
      offer: { product_name: 'Widget', one_sentence: 'Sells widgets' },
      icp: { target_roles: ['VP Sales'], geography: ['US'] },
      credibility: {},
      voice: {},
      meeting: {},
    });

    expect(slim.targetTitles).toEqual(['VP Sales']);
    expect(slim.locations).toEqual(['US']);
    expect(slim.brief).toContain('Sender: Jane · CEO · Acme');
    expect(slim.brief).toContain('Offer: Widget');
  });
});

describe('buildSenderProfileSeed', () => {
  it('builds brief from company summary when brief omitted', () => {
    expect(
      buildSenderProfileSeed({
        fullName: 'Jane Doe',
        title: 'CEO',
        companyName: 'Acme',
        summary: 'We sell widgets',
        targetTitles: ['CFO'],
        locations: ['UK'],
      }),
    ).toEqual({
      targetTitles: ['CFO'],
      locations: ['UK'],
      brief: 'Sender: Jane Doe · CEO · Acme\nOffer: We sell widgets',
      collateralFiles: [],
    });
  });
});
