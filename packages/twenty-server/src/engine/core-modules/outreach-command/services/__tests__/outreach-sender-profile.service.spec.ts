import { OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT } from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { outreachSenderProfileLlmSchema } from 'src/engine/core-modules/outreach-command/schemas/outreach-sender-profile-llm.schema';
import { OutreachSenderProfileService } from 'src/engine/core-modules/outreach-command/services/outreach-sender-profile.service';

describe('OutreachSenderProfileService.getBuildPrompt', () => {
  it('should include system prompt and input sections', () => {
    const service = new OutreachSenderProfileService({} as never, {} as never);
    const prompt = service.getBuildPrompt({
      linkedinProfileText: 'Jane Doe\nCEO',
      collateralText: 'Pitch one-pager',
      senderNotes: 'Focus on factories',
      existingObject: null,
    });

    expect(prompt.system).toBe(OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT);
    expect(prompt.user).toContain('linkedin_profile: Jane Doe');
    expect(prompt.user).toContain('collateral: Pitch one-pager');
    expect(prompt.user).toContain('sender_notes: Focus on factories');
  });
});

describe('outreachSenderProfileLlmSchema', () => {
  it('should parse a minimal valid sender profile', () => {
    const parsed = outreachSenderProfileLlmSchema.parse({
      id: 'sender-1',
      identity: {
        full_name: 'Jane Doe',
        first_name: 'Jane',
        how_they_sign: 'Jane',
        title: 'CEO',
        company: 'Acme',
        company_short: 'Acme',
        website: null,
        phone: null,
        email: null,
        linkedin_url: null,
        city: null,
        timezone: null,
      },
      credibility: {
        one_liner: 'Operator',
        operator_line: 'Ran factories',
        credentials: [],
        years_experience: 10,
        industries_known: ['manufacturing'],
        shared_background_tags: [],
      },
      offer: {
        product_name: 'Acme Ops',
        category: 'ops',
        one_sentence: 'Books factory demos',
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
        geography: [],
        exclude_roles: [],
        exclude_company_types: [],
        known_objections: [],
      },
      voice: {
        register: 'direct',
        formality: 'professional',
        uses_honorifics: false,
        signature_phrases: [],
        avoid_phrases: [],
        sign_off: 'Regards, Jane',
      },
      meeting: {
        default_duration_min: 20,
        platform: 'teams',
        agenda_template: 'Intro',
        preferred_windows: [],
        allow_weekends_if_proposed: true,
      },
      review_flags: ['offer.pricing_line'],
    });

    expect(parsed.identity.first_name).toBe('Jane');
    expect(parsed.review_flags).toEqual(['offer.pricing_line']);
  });
});
