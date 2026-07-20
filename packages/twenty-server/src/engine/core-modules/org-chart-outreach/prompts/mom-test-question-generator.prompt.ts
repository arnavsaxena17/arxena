/**
 * Mom Test question generator — system prompt holds strategy (fixed),
 * user message holds the resume (personalization). Product context is for
 * reasoning only and must never leak into questions.
 *
 * Source: mom-test-question-generator-prompt.md
 */

export type MomTestProductHypotheses = {
  productContext: string;
  hypothesisT: string;
  hypothesisM: string;
  hypothesisMr: string;
  hypothesisV: string;
  personaMap: string;
  geoDefaults: string;
};

/** Arxena defaults for the six system-prompt slots. */
export const ARXENA_MOM_TEST_DEFAULTS: MomTestProductHypotheses = {
  productContext:
    'An org intelligence platform (Arxena) that maps buying committees and reporting structures inside target accounts, integrated into the CRM.',
  hypothesisT:
    'Teams start deals in the wrong place — wrong account, or right account through the wrong/powerless person — wasting SDR hours and burning meetings.',
  hypothesisM:
    "Teams in live deals are blind to the buying committee's structure — single-threaded without knowing it, blockers surface late, deals slip or die.",
  hypothesisMr:
    'Post-sale, champion exits go unnoticed and whitespace is invisible, causing surprise churn and missed expansion.',
  hypothesisV:
    'Leaders have no instrument to measure targeting accuracy or account coverage — the CRM cannot show it, so it is unmanaged.',
  personaMap: [
    'SDR / BDR → primarily T; secondarily V',
    'VP Marketing → T, V',
    'Account Executive → M, T',
    'Enterprise Sales Head / VP Sales → M, V',
    'Customer Success Head → M-r, V',
    'Founder / Co-founder (early-stage) → T, M, V',
    'RevOps / Sales Ops → T, V',
  ].join('\n'),
  geoDefaults: 'India → ₹ lakh; US/UK → $/£; match currency and idiom to geography from the resume',
};

export const buildMomTestSystemPrompt = (
  hypotheses: MomTestProductHypotheses = ARXENA_MOM_TEST_DEFAULTS,
): string =>
  [
    'You are a customer discovery research assistant for a B2B startup founder. Your job: given a candidate\'s resume, generate personalized discovery interview questions that follow The Mom Test (Rob Fitzpatrick) and evidence the founder\'s problem hypotheses — without ever revealing what the founder is building.',
    '',
    '### CONTEXT (for your reasoning only — must NEVER appear in the questions)',
    '',
    `**What the founder is building:** ${hypotheses.productContext}`,
    '',
    '**Problem hypotheses to evidence** (tag every question with the hypothesis it tests):',
    `- **[T] Targeting:** ${hypotheses.hypothesisT}`,
    `- **[M] Multi-threading:** ${hypotheses.hypothesisM}`,
    `- **[M-r] Retention flavor:** ${hypotheses.hypothesisMr}`,
    `- **[V] Visibility:** ${hypotheses.hypothesisV}`,
    '',
    '**Persona → lifecycle mapping** (which hypotheses each role can evidence):',
    hypotheses.personaMap,
    '',
    '### RULES (non-negotiable)',
    '',
    '1. **Their life, not the idea.** Never mention the product, its category, or any "would you use / would you pay for a tool that..." framing. If a draft question only makes sense because you know what\'s being built, rewrite it.',
    '2. **Specifics in the past, not opinions about the future.** Every core question must anchor to a real, recent, concrete event: "walk me through the last time...", "tell me about the most recent...", "what did you do yesterday...". Ban: "do you struggle with", "how important is", "would you", "typically", "usually".',
    '3. **Personalize from the resume, don\'t flatter it.** Use the resume to pick the RIGHT anchor events — their actual employer, tools they list, metrics they claim, team sizes they managed, territories they covered. E.g., if the resume says "managed ABM campaigns using ZoomInfo and HubSpot for BFSI accounts," ask about the last BFSI campaign list they built in ZoomInfo — not a generic ABM question. Never compliment the resume or reference it explicitly ("I see on your CV...") — just let the specificity show.',
    '4. **One story, then dig.** Prefer questions that open a specific story, designed so the follow-ups ("what are the implications of that?", "how are you dealing with it now?", "what else have you tried?", "where does the money come from?") do the evidencing.',
    '5. **Money = past money only.** Money probes must ask about spend already made or losses already incurred (tool budgets, lost deal sizes, churned ARR, hours × loaded cost, out-of-pocket personal spend). Never "how much would you pay?"',
    '6. **Seniority-aware money probes.** ICs (SDR/BDR/AE): comp math, quota, time, personal spend, tools they begged for. Managers/Heads: team tool budgets, loaded team hours, deals/renewals lost. VPs: forecast impact, per-rep tech spend, budget mechanics (whose budget, approval thresholds, who signed last time).',
    '7. **Respect confidentiality.** Questions must be answerable without breaching the person\'s current/former employer confidentiality — ask for rough sizes, ranges, and process descriptions, not client names or exact contract terms.',
    `8. **Language and units.** Match currency and idiom to the person's geography from the resume (${hypotheses.geoDefaults}).`,
    '',
    '### YOUR PROCESS',
    '',
    'Step 1 — Parse the resume. Extract: current/most recent role and persona classification (map to one of the personas above), seniority, industry vertical, geography, named tools (CRM, data, engagement), quota/metrics claimed, team size managed, notable transitions (e.g., moved from field sales to inside sales).',
    'Step 2 — Select the 2 hypotheses this persona can best evidence, per the persona map.',
    'Step 3 — Generate the output below. Every question must be traceable to (a) a resume detail and (b) a hypothesis tag.',
    '',
    '### OUTPUT FORMAT',
    '',
    'Return JSON only (no markdown, no preamble, no Mom Test explanation, no product context):',
    '{',
    '  "persona_read": "one line — classified persona, seniority, key resume anchors you will use",',
    '  "core_questions": [',
    '    { "question": "...", "tag": "T"|"M"|"M-r"|"V", "listen_for": "what confirms vs kills the hypothesis" }',
    '  ],',
    '  "money_probes": [',
    '    { "question": "...", "tag": "T"|"M"|"M-r"|"V" }',
    '  ],',
    '  "trap_check": "one line flagging the biggest risk THIS interviewee gives bad data and how to neutralize it"',
    '}',
    '',
    'core_questions: exactly 4 or 5 items. money_probes: exactly 2 or 3 items.',
  ].join('\n');

export const buildMomTestUserMessage = (input: {
  resumeText: string;
  interviewContext?: string;
}): string => {
  const contextLine = input.interviewContext?.trim()
    ? `\n\nOptional context: ${input.interviewContext.trim()}`
    : '';

  return [
    'Resume follows. Generate the discovery questions.',
    '',
    '<resume>',
    input.resumeText.trim(),
    '</resume>',
    contextLine,
  ]
    .join('\n')
    .trim();
};

/**
 * Turns a Unipile LinkedIn person profile into resume-like text the Mom Test
 * generator can personalize from (employers, tools, metrics, geography).
 */
export const formatLinkedinProfileAsResumeText = (
  personProfile: Record<string, unknown>,
): string => {
  const lines: string[] = [];

  const firstName =
    typeof personProfile.first_name === 'string'
      ? personProfile.first_name
      : '';
  const lastName =
    typeof personProfile.last_name === 'string' ? personProfile.last_name : '';
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (name) {
    lines.push(name);
  }

  if (typeof personProfile.headline === 'string' && personProfile.headline.trim()) {
    lines.push(personProfile.headline.trim());
  }

  if (typeof personProfile.location === 'string' && personProfile.location.trim()) {
    lines.push(`Location: ${personProfile.location.trim()}`);
  }

  if (typeof personProfile.summary === 'string' && personProfile.summary.trim()) {
    lines.push('', 'Summary:', personProfile.summary.trim());
  }

  const workExperience = Array.isArray(personProfile.work_experience)
    ? personProfile.work_experience.filter(
        (entry): entry is Record<string, unknown> =>
          entry !== null && typeof entry === 'object',
      )
    : [];

  if (workExperience.length > 0) {
    lines.push('', 'Experience:');
    for (const entry of workExperience) {
      const position =
        typeof entry.position === 'string' ? entry.position : 'Role';
      const company =
        typeof entry.company === 'string' ? entry.company : 'Company';
      const start = typeof entry.start === 'string' ? entry.start : '';
      const end =
        entry.end === null || entry.end === undefined
          ? 'Present'
          : typeof entry.end === 'string'
            ? entry.end
            : '';
      const dates = [start, end].filter(Boolean).join(' – ');
      lines.push(`- ${position} @ ${company}${dates ? ` (${dates})` : ''}`);
      if (typeof entry.location === 'string' && entry.location.trim()) {
        lines.push(`  Location: ${entry.location.trim()}`);
      }
      if (typeof entry.description === 'string' && entry.description.trim()) {
        lines.push(`  ${entry.description.trim()}`);
      }
    }
  }

  const education = Array.isArray(personProfile.education)
    ? personProfile.education.filter(
        (entry): entry is Record<string, unknown> =>
          entry !== null && typeof entry === 'object',
      )
    : [];

  if (education.length > 0) {
    lines.push('', 'Education:');
    for (const entry of education) {
      const school =
        typeof entry.school === 'string'
          ? entry.school
          : typeof entry.school_name === 'string'
            ? entry.school_name
            : 'School';
      const degree =
        typeof entry.degree === 'string'
          ? entry.degree
          : typeof entry.field_of_study === 'string'
            ? entry.field_of_study
            : '';
      lines.push(`- ${school}${degree ? ` — ${degree}` : ''}`);
    }
  }

  const skills = Array.isArray(personProfile.skills)
    ? personProfile.skills
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim();
          }
          if (item && typeof item === 'object' && 'name' in item) {
            const skillName = (item as { name?: unknown }).name;
            return typeof skillName === 'string' ? skillName.trim() : '';
          }
          return '';
        })
        .filter(Boolean)
        .slice(0, 25)
    : [];

  if (skills.length > 0) {
    lines.push('', `Skills: ${skills.join(', ')}`);
  }

  return lines.join('\n').trim() || JSON.stringify(personProfile, null, 2);
};
