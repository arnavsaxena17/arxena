const stringifyForPrompt = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const buildIcpExtractionPrompt = (input: {
  personProfile: Record<string, unknown>;
  companyProfile: Record<string, unknown> | null;
  postsSummary?: string;
}): string => {
  const postsSection = input.postsSummary?.trim()
    ? ['', 'Recent LinkedIn posts by this person:', input.postsSummary.trim()]
    : [];

  const companySection = input.companyProfile
    ? `Company profile: ${stringifyForPrompt(input.companyProfile)}`
    : [
        'Company profile: NOT AVAILABLE — no LinkedIn company page could be',
        "loaded for this person's company. Infer what the company sells from",
        "the person's headline, summary, and current-role description in the",
        'person profile (and posts, if provided). Be conservative: if those',
        'do not indicate a sellable product or service, mark the recipient',
        'not relevant rather than inventing an offering.',
      ].join('\n');

  return [
    'You are screening a cold-outreach lead to decide whether a specific',
    'tactic — a "target-account org chart lure" — will land with them,',
    'and if so, what to build.',
    '',
    'CONTEXT: What a target-account lure is.',
    'Instead of a generic cold-email pitch, the first line offers the',
    'recipient something concretely useful and unfakeable: a free, real',
    'org chart (reporting lines, function heads) of ONE SPECIFIC COMPANY',
    'the recipient is already trying to sell to. It only works because it',
    'could not have been mass-sent — it proves real work was done on this',
    "exact recipient's world, not a template. Two things must be true",
    'for it to land:',
    '(a) The recipient personally has "target accounts" — they are',
    '    involved, even loosely, in bringing in new customers for their',
    '    own company (founder, salesperson, BD/growth, or a technical',
    '    co-founder at a small team where everyone sells).',
    "(b) The org chart has to map to the function that person's own",
    '    product would actually be sold to at a target company — a chart',
    '    of the Sales org is useless to someone selling an SRE tool; they',
    '    need the Engineering/Platform org instead.',
    '',
    "Given this person's LinkedIn profile and their company's LinkedIn",
    'profile, determine:',
    '',
    "1. What does this person's company actually sell (product, category)?",
    '2. Who would THAT company want to reach as a customer — industry,',
    '   company size range, likely tech stack signals, and the specific',
    '   job title(s) that would be the buyer or economic buyer.',
    "3. Is this specific person plausibly involved in their own company's",
    '   sales/BD motion, such that a target-account lure would land on',
    '   THEM specifically? Use these signals:',
    '   TRUE if: founder/co-founder (especially at a company small enough',
    '   that founders still sell personally — check employee_count), an',
    '   explicit sales/BD/growth/partnerships title, a LinkedIn summary',
    '   that reads like outbound sales copy (pitches the product, ends',
    '   with a call to connect), or job history with revenue-facing',
    '   responsibility.',
    '   FALSE if: a pure technical/operational IC role with no sales',
    '   signal anywhere in the profile, especially at a company large',
    '   enough (roughly 200+ employees) to have a dedicated sales org the',
    '   person has no evident tie to, or a function unrelated to revenue',
    '   (HR, Legal, back-office Finance) with no contrary evidence.',
    '   AMBIGUOUS cases (e.g. a technical co-founder, a "Head of X" title',
    '   that could include BD): lean TRUE if the company is small/early',
    "   enough that role specialization hasn't happened yet — but say so",
    '   explicitly in your reasoning. Do not default to TRUE to be more',
    '   useful to the caller; an incorrect TRUE wastes a send on the',
    '   wrong lure entirely, which is worse than a correct FALSE.',
    '4. If TRUE: what specific function/team, at a target company,',
    '   should the org chart focus on to be useful to this person? Anchor',
    '   this to what their company sells (step 1) — e.g. a security',
    '   product → chart the Security/IT function at the target; an SRE',
    '   tool → chart Engineering/Platform; a sales tool → chart Sales/',
    '   RevOps. If FALSE, leave this null.',
    '',
    `Person profile: ${stringifyForPrompt(input.personProfile)}`,
    companySection,
    ...postsSection,
    '',
    'Output as JSON only, no other text:',
    '{',
    '  "sells": "...",',
    '  "relevant_recipient_for_target_account_lure": true/false,',
    '  "reasoning": "... — must explicitly justify the true/false call',
    '    from step 3 using the signals above, not just restate the',
    "    person's title\",",
    '  "icp": {',
    '    "industry": [...],',
    '    "employee_range": "...",',
    '    "tech_stack_signals": [...],',
    '    "buyer_titles": [...],',
    '    "pain_signals": [...]',
    '  },',
    '  "chart_function": "..." or null',
    '}',
  ].join('\n');
};
