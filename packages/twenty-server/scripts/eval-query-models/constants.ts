// ─────────────────────────────────────────────────────────────────────────────
// SEARCH TYPES
// ─────────────────────────────────────────────────────────────────────────────
export type SearchType = 'recruiter' | 'sales_navigator' | 'classic';
export const ALL_SEARCH_TYPES: SearchType[] = ['recruiter', 'sales_navigator', 'classic'];

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT MODES
// ─────────────────────────────────────────────────────────────────────────────
export type PromptMode = 'detailed' | 'simple' | 'agent';
export const ALL_PROMPT_MODES: PromptMode[] = ['detailed', 'simple', 'agent'];

// ─────────────────────────────────────────────────────────────────────────────
// 20 DIVERSE TEST REQUIREMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const REQUIREMENTS: Array<{ id: string; label: string; query: string }> = [
  // ── Sales & Commercial ──
  {
    id: 'sales_channel',
    label: 'Channel Partner Manager – Telecom Gujarat',
    query: 'Find channel partner managers from telecom equipment vendors in Gujarat with B2B focus',
  },
  {
    id: 'sales_vp_growth',
    label: 'VP Growth – Consumer Tech App',
    query: 'VP Growth for consumer tech app - User acquisition experts from CRED, PhonePe with performance marketing and retention analytics',
  },
  // {
  //   id: 'sales_cs_head',
  //   label: 'Head of Customer Success – Enterprise SaaS',
  //   query: 'Head of Customer Success for enterprise SaaS - Salesforce, ServiceNow customer success VPs with logo retention and expansion strategies',
  // },
  // // ── Engineering & Product ──
  // {
  //   id: 'eng_ev_mgr',
  //   label: 'Engineering Manager – EV Battery Pune/Bangalore',
  //   query: 'Give me engineering managers from EV companies in Pune or Bangalore with battery technology expertise',
  // },
  // {
  //   id: 'tech_cto_fintech',
  //   label: 'CTO – Fintech Unicorn',
  //   query: 'CTO for fintech unicorn - PhonePe, Paytm, Razorpay engineering heads with payments infrastructure and RBI compliance tech',
  // },
  // {
  //   id: 'tech_ciso',
  //   label: 'CISO – Large Enterprise BFSI',
  //   query: 'Chief Information Security Officer for large enterprise - BFSI CISO backgrounds with ISO 27001, SOC 2',
  // },
  // // ── Manufacturing ──
  // {
  //   id: 'mfg_battery_site',
  //   label: 'Site Head – Battery Manufacturing Tamil Nadu',
  //   query: 'Site Head for battery manufacturing unit in Tamil Nadu - EV battery experience from Exide, Amara Raja, LG Chem',
  // },
  // {
  //   id: 'mfg_excellence_vp',
  //   label: 'VP Manufacturing Excellence – Consumer Durables',
  //   query: 'VP Manufacturing Excellence for consumer durables - Six Sigma Black Belts from Whirlpool, LG, Samsung',
  // },
  // // ── Executive Leadership / Operations ──
  // {
  //   id: 'ops_coo_auto',
  //   label: 'COO – Auto Components Manufacturer Pune',
  //   query: 'COO for Rs 800 Cr auto components manufacturer in Pune - Motherson, Bharat Forge, Sona Comstar with P&L 500+ Cr',
  // },
  // {
  //   id: 'scm_head_fmcg',
  //   label: 'Head of Supply Chain – FMCG Multi-Site',
  //   query: 'Head of Supply Chain for FMCG company with 8 units - ITC, Marico, Dabur with multi-site logistics',
  // },
  // // ── Finance ──
  // {
  //   id: 'fin_cfo_nbfc',
  //   label: 'CFO – PE-Backed NBFC',
  //   query: 'CFO for PE-backed NBFC - Bajaj Finance, Cholamandalam with Ind AS and RBI compliance',
  // },
  // // ── Banking & Financial Services ──
  // {
  //   id: 'banking_sme_head',
  //   label: 'Head of SME Banking – Private Bank',
  //   query: 'Head of SME Banking for private bank - RBHs from Axis, ICICI with 2000+ Cr SME book',
  // },
  // // ── Insurance ──
  // {
  //   id: 'insurance_actuary',
  //   label: 'Chief Actuary – Life Insurance',
  //   query: 'Chief Actuary for life insurance - Qualified actuaries with product development',
  // },
  // // ── Human Resources ──
  // {
  //   id: 'hr_chro_mfg',
  //   label: 'CHRO – Manufacturing Group 10,000+ employees',
  //   query: 'CHRO for manufacturing group (10,000+) - Multi-site HR from Aditya Birla, Vedanta with IR',
  // },
  // // ── Legal & Compliance ──
  // {
  //   id: 'legal_pharma_head',
  //   label: 'Head of Corporate Legal – Pharma Patent Litigation',
  //   query: 'Head of Corporate Legal for pharma - Sun Pharma, Lupin with patent litigation and FDA',
  // },
  // // ── Investment & PE ──
  // {
  //   id: 'pe_vc_managing',
  //   label: 'Managing Partner – Sector-Focused VC',
  //   query: 'Managing Partner for sector-focused VC - Healthcare/fintech angels with operator background',
  // },
  // // ── R&D ──
  // {
  //   id: 'rd_meddevice',
  //   label: 'Head R&D – Medical Devices Startup',
  //   query: 'Head of R&D and Manufacturing for medical devices startup - J&J, Siemens Healthineers with regulatory',
  // },
  // // ── Healthcare / Medical Specialists (tests specialist scoring) ──
  // {
  //   id: 'med_pulmonologist',
  //   label: 'Pulmonologist – Mumbai Hospitals',
  //   query: 'Give me Pulmonologists in hospitals in Mumbai',
  // },
  // {
  //   id: 'med_cardiologist',
  //   label: 'Cardiologist – Delhi NCR Interventional',
  //   query: 'Find Cardiologists from multi-specialty hospitals in Delhi NCR with interventional cardiology experience',
  // },
  // {
  //   id: 'med_cardiology_hod',
  //   label: 'Head of Cardiology Dept – Mumbai Hospital',
  //   query: 'Give me Head of Cardiology departments from hospitals in Mumbai with 20+ years experience',
  // },
];

// ─────────────────────────────────────────────────────────────────────────────
// MODEL PRICING  (per 1M tokens, standard tier — OpenAI platform pricing, Mar 2026)
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o':                    { inputPer1M: 2.50,  outputPer1M: 10.00 },
  'gpt-4o-mini':               { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gpt-4.1':                   { inputPer1M: 2.00,  outputPer1M: 8.00  },
  'gpt-4.1-mini':              { inputPer1M: 0.40,  outputPer1M: 1.60  },
  'gpt-4.1-nano':              { inputPer1M: 0.10,  outputPer1M: 0.40  },
  'gpt-5':                     { inputPer1M: 1.25,  outputPer1M: 10.00 },
  'gpt-5-mini':                { inputPer1M: 0.25,  outputPer1M: 2.00  },
  'gpt-5-nano':                { inputPer1M: 0.05,  outputPer1M: 0.40  },
  'gpt-5-pro':                 { inputPer1M: 15.00, outputPer1M: 120.0 },
  'gpt-5.1':                   { inputPer1M: 1.25,  outputPer1M: 10.00 },
  'gpt-5.2':                   { inputPer1M: 1.75,  outputPer1M: 14.00 },
  'gpt-5.2-pro':               { inputPer1M: 21.00, outputPer1M: 168.0 },
  'gpt-5.4':                   { inputPer1M: 2.50,  outputPer1M: 15.00 },
  'gpt-5.4-mini':              { inputPer1M: 0.75,  outputPer1M: 4.50  },
  'gpt-5.4-nano':              { inputPer1M: 0.20,  outputPer1M: 1.25  },
  'gpt-5.4-pro':               { inputPer1M: 30.00, outputPer1M: 180.0 },
  'gpt-5.3-chat-latest':       { inputPer1M: 1.75,  outputPer1M: 14.00 },
  'gpt-5.3-codex':             { inputPer1M: 1.75,  outputPer1M: 14.00 },
  'o1':                        { inputPer1M: 15.00, outputPer1M: 60.00 },
  'o1-mini':                   { inputPer1M: 1.10,  outputPer1M: 4.40  },
  'o1-pro':                    { inputPer1M: 150.0, outputPer1M: 600.0 },
  'o3':                        { inputPer1M: 2.00,  outputPer1M: 8.00  },
  'o3-mini':                   { inputPer1M: 1.10,  outputPer1M: 4.40  },
  'o3-pro':                    { inputPer1M: 20.00, outputPer1M: 80.00 },
  'o4-mini':                   { inputPer1M: 1.10,  outputPer1M: 4.40  },
  'o4-mini-deep-research':     { inputPer1M: 1.10,  outputPer1M: 4.40  },
  'claude-sonnet-4-6':         { inputPer1M: 3.00,  outputPer1M: 15.00 },
};

/**
 * Calculate cost in USD.
 * OpenAI automatically caches repeated prompt prefixes ≥1024 tokens at 50% input price.
 * Pass cachedTokens (from usage.prompt_tokens_details?.cached_tokens) for accurate cost.
 */
export function calcCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
): number {
  const p = MODEL_PRICING[modelId];
  if (!p) return 0;
  const uncachedIn = inputTokens - cachedTokens;
  return (
    (uncachedIn    / 1_000_000) * p.inputPer1M +
    (cachedTokens  / 1_000_000) * p.inputPer1M * 0.5 +   // 50% discount on cached tokens
    (outputTokens  / 1_000_000) * p.outputPer1M
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELS TO EVALUATE
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_MODELS: Array<{
  id: string;
  label: string;
  provider: 'openai' | 'anthropic';
  isReasoning?: boolean;
  isDeepResearch?: boolean;
}> = [
  // GPT-4o family
  // { id: 'gpt-4o',       label: 'gpt-4o',       provider: 'openai' },
  // { id: 'gpt-4o-mini',  label: 'gpt-4o-mini',  provider: 'openai' },
  // GPT-4.1 family
  { id: 'gpt-4.1',      label: 'gpt-4.1',      provider: 'openai' },
  { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini', provider: 'openai' },
  { id: 'gpt-4.1-nano', label: 'gpt-4.1-nano', provider: 'openai' },
  // GPT-5.4 family
  { id: 'gpt-5.4-mini', label: 'gpt-5.4-mini', provider: 'openai' },
  { id: 'gpt-5.4-nano', label: 'gpt-5.4-nano', provider: 'openai' },
  // GPT-5 family (Aug 2025)
  { id: 'gpt-5-mini',   label: 'gpt-5-mini',   provider: 'openai' },
  { id: 'gpt-5-nano',   label: 'gpt-5-nano',   provider: 'openai' },
];
