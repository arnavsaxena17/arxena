import { z } from 'zod';

const nullableString = z.string().nullable();

const faqItemSchema = z.object({
  q: z.string(),
  a: z.string(),
});

const collateralItemSchema = z.object({
  name: z.string(),
  file_id: z.string(),
  when_to_send: z.string(),
});

const objectionSchema = z.object({
  objection: z.string(),
  response: z.string(),
});

export const outreachSenderProfileLlmSchema = z.object({
  id: z.string(),
  identity: z.object({
    full_name: nullableString,
    first_name: nullableString,
    how_they_sign: nullableString,
    title: nullableString,
    company: nullableString,
    company_short: nullableString,
    website: nullableString,
    phone: nullableString,
    email: nullableString,
    linkedin_url: nullableString,
    city: nullableString,
    timezone: nullableString,
  }),
  credibility: z.object({
    one_liner: nullableString,
    operator_line: nullableString,
    credentials: z.array(z.string()),
    years_experience: z.number().nullable(),
    industries_known: z.array(z.string()),
    shared_background_tags: z.array(z.string()),
  }),
  offer: z.object({
    product_name: nullableString,
    category: nullableString,
    one_sentence: nullableString,
    problem_statements: z.array(z.string()),
    outcomes: z.array(z.string()),
    proof_points: z.array(z.string()),
    works_with: z.array(z.string()),
    implementation_time: nullableString,
    pilot_offer: nullableString,
    pricing_line: nullableString,
    data_security_line: nullableString,
    faq: z.array(faqItemSchema),
    collateral: z.array(collateralItemSchema),
  }),
  icp: z.object({
    target_roles: z.array(z.string()),
    target_company_profile: nullableString,
    revenue_band: nullableString,
    geography: z.array(z.string()),
    exclude_roles: z.array(z.string()),
    exclude_company_types: z.array(z.string()),
    known_objections: z.array(objectionSchema),
  }),
  voice: z.object({
    register: nullableString,
    formality: nullableString,
    uses_honorifics: z.boolean(),
    signature_phrases: z.array(z.string()),
    avoid_phrases: z.array(z.string()),
    sign_off: nullableString,
  }),
  meeting: z.object({
    default_duration_min: z.number(),
    platform: nullableString,
    agenda_template: nullableString,
    preferred_windows: z.array(z.string()),
    allow_weekends_if_proposed: z.boolean(),
  }),
  review_flags: z.array(z.string()).optional(),
});

export type OutreachSenderProfileLlmResult = z.infer<
  typeof outreachSenderProfileLlmSchema
>;
