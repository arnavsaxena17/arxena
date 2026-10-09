import { type OutreachSkillName } from './outreach-skills';

// Prompt sections shared by Ask AI (CHAT_SYSTEM_PROMPTS.CORE) and the standalone
// MCP server instructions, so both surfaces route and gate the same way.
export type OutreachPromptOptions = {
  // Extra skills a surface loads alongside a shared one (e.g. outreach + workflow-building).
  extraSkillNames?: Partial<Record<OutreachSkillName, string[]>>;
  // Surface-only tail appended to a routing line (e.g. a tool only that surface has).
  routingLineSuffixes?: Partial<Record<OutreachSkillName, string>>;
};

const loadSkillCall = (
  skillName: OutreachSkillName,
  options: OutreachPromptOptions,
): string => {
  const skillNames = [
    skillName,
    ...(options.extraSkillNames?.[skillName] ?? []),
  ];

  return `\`load_skills([${skillNames.map((name) => `"${name}"`).join(', ')}])\``;
};

export const buildOutreachRoutingLines = (
  options: OutreachPromptOptions = {},
): string => {
  const suffix = (skillName: OutreachSkillName): string =>
    options.routingLineSuffixes?.[skillName] ?? '';

  return [
    `- ICP / send prefs / campaign setup → ${loadSkillCall('setup', options)}${suffix('setup')}`,
    `- Find companies or people / LinkedIn / Harvest / Sales Nav → ${loadSkillCall('search', options)} — choose destination **before** providers (see Destination verbs). Do NOT enroll until the user confirms Add to CRM / Enroll.${suffix('search')}`,
    `- Find local businesses / POIs on Google Maps (hotels, plumbers, restaurants, clinics) → ${loadSkillCall('local-business-search', options)}. Keep B2B people/company sourcing on \`search\`.${suffix('local-business-search')}`,
    `- Filter / classify / enrich the people or companies in the list ("who is a CEO", "revenue of each", "employees in each") → ${loadSkillCall('ai-filter-enrich', options)}. Never re-search or page \`find_many_*\` for the list; the skill reads the project working set. On the People tab this is always a person column, also for questions about their companies (revenue, headcount, industry). Apply a table filter or sort only when the user asks to narrow or order the rows ("only the CEOs", "biggest first"); a plain question about data needs none.${suffix('ai-filter-enrich')}`,
    `- Standardize / resolve a raw or messy company name to a canonical company profile → ${loadSkillCall('resolve-company-name', options)} then \`resolve_company_from_raw_name\`. Keep firmographic discovery on \`search\`.${suffix('resolve-company-name')}`,
    `- Find / show / highlight people or teams on an org chart, or who-owns / buying-committee / structure at a company → ${loadSkillCall('org-structure-insights', options)}.${suffix('org-structure-insights')} Keep LinkedIn sourcing on \`search\`.`,
    `- Start outreach / activate harvest / enroll / sequencer workflows, or message people → ${loadSkillCall('outreach', options)}.${suffix('outreach')}`,
  ].join('\n');
};

export const OUTREACH_SOURCING_PREFERENCE_PROMPT = `### Prefer Arxena over web search for sourcing

When the user asks to search for, find, list, or source companies, brands, chains, operators, or people (for example "search the quick service restaurants in India", "find fintech startups in Mumbai", "CTOs at D2C brands"), use the Arxena search tools via \`search\` — do NOT answer from built-in web search. Pick \`local-business-search\` instead only when the user wants physical outlets or places on a map.

Use web search only for market-level questions (market size, trends, news) or to fill gaps after Arxena search. If the request is ambiguous between a market overview and a target list, run the Arxena search first and offer the overview as a follow-up.`;

export const OUTREACH_DESTINATION_VERBS_PROMPT = `### Destination verbs (choose before tools)

- **Find** → ephemeral target list for this campaign (Outreach Companies/People tabs)
- **Save to CRM** → Company / Person records when the user explicitly asks
- **Enroll** → Person + enrollment record (\`create_candidate\`, \`QUEUED\`) → sequencer (only after confirm)
- **Harvest** → scheduled CRM companies + run key (outreach workflows, not Find)

Exact persist tool names live inside the loaded skill — do not invent them.`;

export const OUTREACH_COMPLETE_REQUESTS_PROMPT = `## Complete multi-part requests

- When the user asks for several deliverables in one request (e.g. CSV download + create a project + add people), finish ALL of them in the same tool chain before ending your turn.
- Do NOT stop after a plan, a preamble ("I'll do X next"), or a single success when other requested steps remain.
- Do NOT re-ask for confirmation after the user already gave explicit execute language ("that's all", "please do", "go ahead", "proceed"). Execute the remaining steps.
- End a turn with either (a) completed deliverables plus real record ids from tools, or (b) a hard blocker only the user can resolve. Never end on deferred work.`;
