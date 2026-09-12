export type OutreachSenderFaqItem = {
  q: string;
  a: string;
};

export type OutreachSenderCollateralItem = {
  name: string;
  file_id: string;
  when_to_send: string;
};

export type OutreachSenderObjection = {
  objection: string;
  response: string;
};

export type OutreachSenderProfile = {
  id: string;
  identity: {
    full_name: string | null;
    first_name: string | null;
    how_they_sign: string | null;
    title: string | null;
    company: string | null;
    company_short: string | null;
    website: string | null;
    phone: string | null;
    email: string | null;
    linkedin_url: string | null;
    city: string | null;
    timezone: string | null;
  };
  credibility: {
    one_liner: string | null;
    operator_line: string | null;
    credentials: string[];
    years_experience: number | null;
    industries_known: string[];
    shared_background_tags: string[];
  };
  offer: {
    product_name: string | null;
    category: string | null;
    one_sentence: string | null;
    problem_statements: string[];
    outcomes: string[];
    proof_points: string[];
    works_with: string[];
    implementation_time: string | null;
    pilot_offer: string | null;
    pricing_line: string | null;
    data_security_line: string | null;
    faq: OutreachSenderFaqItem[];
    collateral: OutreachSenderCollateralItem[];
  };
  icp: {
    target_roles: string[];
    target_company_profile: string | null;
    revenue_band: string | null;
    geography: string[];
    exclude_roles: string[];
    exclude_company_types: string[];
    known_objections: OutreachSenderObjection[];
  };
  voice: {
    register: string | null;
    formality: string | null;
    uses_honorifics: boolean;
    signature_phrases: string[];
    avoid_phrases: string[];
    sign_off: string | null;
  };
  meeting: {
    default_duration_min: number;
    platform: string | null;
    agenda_template: string | null;
    preferred_windows: string[];
    allow_weekends_if_proposed: boolean;
  };
  review_flags?: string[];
};

export type OutreachProspectEnrichment = {
  go: boolean;
  score: number;
  segment: string;
  reason: string;
  first_name: string;
  honorific: string | null;
  company_short: string;
  industry_phrase: string;
  hooks: Array<{ text: string; source: string }>;
  likely_systems: string;
  matching_problem_statement: string;
  referral_source: string | null;
};
