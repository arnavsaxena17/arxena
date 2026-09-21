import {
  applyIcpSpecToSenderProfile,
  buildSenderProfileSeedFromWorkspace,
  icpSpecFromSenderIcp,
  mergeSenderProfileSeedOntoExisting,
} from 'src/engine/core-modules/outreach-command/utils/outreach-sender-icp-sync.util';
import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';

const buildMinimalProfile = (
  overrides?: Partial<OutreachSenderProfile>,
): OutreachSenderProfile => ({
  id: 'sender-1',
  identity: {
    full_name: 'Jane Doe',
    first_name: 'Jane',
    how_they_sign: 'Jane',
    title: 'CEO',
    company: 'Acme',
    company_short: 'Acme',
    website: 'https://acme.com',
    phone: null,
    email: 'jane@acme.com',
    linkedin_url: null,
    city: null,
    timezone: null,
  },
  credibility: {
    one_liner: null,
    operator_line: null,
    credentials: [],
    years_experience: null,
    industries_known: [],
    shared_background_tags: [],
  },
  offer: {
    product_name: 'Acme Ops',
    category: null,
    one_sentence: null,
    problem_statements: [],
    outcomes: [],
    proof_points: [],
    works_with: [],
    implementation_time: null,
    pilot_offer: null,
    pricing_line: null,
    data_security_line: null,
    faq: [],
    collateral: [],
  },
  icp: {
    target_roles: ['Plant Head'],
    target_company_profile: null,
    revenue_band: null,
    geography: ['India'],
    exclude_roles: [],
    exclude_company_types: [],
    known_objections: [],
  },
  voice: {
    register: null,
    formality: null,
    uses_honorifics: false,
    signature_phrases: [],
    avoid_phrases: [],
    sign_off: null,
  },
  meeting: {
    default_duration_min: 30,
    platform: null,
    agenda_template: null,
    preferred_windows: [],
    allow_weekends_if_proposed: false,
  },
  ...overrides,
});

describe('outreach-sender-icp-sync.util', () => {
  it('maps sender icp to workspace icpSpec', () => {
    expect(icpSpecFromSenderIcp(buildMinimalProfile().icp)).toEqual({
      targetTitles: ['Plant Head'],
      locations: ['India'],
    });
  });

  it('applies icpSpec onto sender, overwriting by default', () => {
    const next = applyIcpSpecToSenderProfile(buildMinimalProfile(), {
      targetTitles: ['VP Sales'],
      locations: ['US'],
    });

    expect(next.icp.target_roles).toEqual(['VP Sales']);
    expect(next.icp.geography).toEqual(['US']);
  });

  it('fillEmptyOnly keeps existing non-empty titles and geos', () => {
    const next = applyIcpSpecToSenderProfile(
      buildMinimalProfile(),
      {
        targetTitles: ['VP Sales'],
        locations: ['US'],
      },
      { fillEmptyOnly: true },
    );

    expect(next.icp.target_roles).toEqual(['Plant Head']);
    expect(next.icp.geography).toEqual(['India']);
  });

  it('builds a seed profile from workspace company + icp without LinkedIn', () => {
    const seed = buildSenderProfileSeedFromWorkspace({
      member: {
        id: 'member-1',
        name: { firstName: 'Jane', lastName: 'Doe' },
        userEmail: 'jane@acme.com',
      },
      companyName: 'Acme',
      companyDomain: 'acme.com',
      industry: 'Manufacturing',
      summary: 'Makes widgets',
      hq: 'Pune',
      icpSpec: {
        targetTitles: ['Head of Talent'],
        locations: ['India'],
      },
    });

    expect(seed.identity.full_name).toBe('Jane Doe');
    expect(seed.identity.company).toBe('Acme');
    expect(seed.identity.website).toBe('https://acme.com');
    expect(seed.offer.one_sentence).toBe('Makes widgets');
    expect(seed.icp.target_roles).toEqual(['Head of Talent']);
    expect(seed.icp.geography).toEqual(['India']);
    expect(seed.icp.target_company_profile).toBe('Makes widgets');
  });

  it('merge force replaces company/icp while keeping voice', () => {
    const existing = buildMinimalProfile({
      voice: {
        register: 'warm',
        formality: 'casual',
        uses_honorifics: true,
        signature_phrases: ['cheers'],
        avoid_phrases: [],
        sign_off: 'Cheers',
      },
    });
    const seed = buildSenderProfileSeedFromWorkspace({
      member: { id: 'member-1', name: { firstName: 'Jane', lastName: 'Doe' } },
      companyName: 'NewCo',
      companyDomain: 'newco.com',
      icpSpec: { targetTitles: ['CRO'], locations: ['UK'] },
    });

    const merged = mergeSenderProfileSeedOntoExisting(existing, seed, {
      force: true,
    });

    expect(merged.identity.company).toBe('NewCo');
    expect(merged.icp.target_roles).toEqual(['CRO']);
    expect(merged.voice.sign_off).toBe('Cheers');
  });
});
