export type GtmSkill = {
  name: string;
  label: string;
  content: string;
};

export const GTM_SKILLS: readonly GtmSkill[] = [
  {
    name: 'org-structure-insights',
    label: 'Org Structure Insights',
    content: `# Org Structure Insights

Answer org-map questions with pack \`orgchart\` tools.

## Plan → Skill → Learn → Execute

1. \`load_skills(["org-structure-insights"])\`
2. \`learn_tools\` once with tools you will use:

\`\`\`
learn_tools({
  toolNames: [
    "list_org_chart_positions",
    "search_org_charts_by_function",
    "list_taxonomy_function_roots",
    "list_taxonomy_functions",
    "list_taxonomy_grades",
    "get_org_chart_node_people",
    "google_serp_search"
  ]
})
\`\`\`

3. \`execute_tool({ toolName, arguments })\` for each call.

## Playbook

- Prefer \`list_org_chart_positions\` for structure (compact rows). Avoid \`get_org_chart\` unless you need the full tree.
- Drill people with \`get_org_chart_node_people\` using \`nodeKey\` (or taxonomy filters). Do not invent names.
- Taxonomy: \`std_function_root\` / \`std_function\` / \`std_grade\` — resolve with list_taxonomy_* tools.
`,
  },
  {
    name: 'search-people',
    label: 'Search People',
    content: `# Search People

Prospect people with pack \`prospecting\` / \`enrichment\` tools.

## learn_tools

\`\`\`
learn_tools({
  toolNames: [
    "search_apollo_people",
    "search_linkedin_people",
    "search_people_api",
    "search_people_index",
    "check_contact_availability",
    "fetch_contacts",
    "create_candidate"
  ]
})
\`\`\`

## Provider map

| Source | Tool | Notes |
| --- | --- | --- |
| Apollo | \`search_apollo_people\` | Firmographic + contact |
| LinkedIn | \`search_linkedin_people\` | Needs Unipile account |
| People API | \`search_people_api\` / \`search_people_by_job_title\` | Taxonomy-backed |
| Internal index | \`search_people_index\` | Workspace ES index |

Dedup by name + email/linkedin before \`create_candidate\`. Enrich with \`check_contact_availability\` then \`fetch_contacts\`.
`,
  },
  {
    name: 'search-companies',
    label: 'Search Companies',
    content: `# Search Companies

\`\`\`
learn_tools({
  toolNames: [
    "search_apollo_companies",
    "search_linkedin_companies",
    "search_companies_index",
    "search_wikidata_companies",
    "expand_companies"
  ]
})
\`\`\`

Use \`expand_companies\` after a JD / brief when you need lookalike accounts.
`,
  },
  {
    name: 'outreach',
    label: 'Outreach Messaging',
    content: `# Outreach

Send and read candidate messages (pack \`outreach\`).

\`\`\`
learn_tools({
  toolNames: [
    "send_chat",
    "send_bulk_chats_by_candidate_ids",
    "get_all_messages_by_candidate_id",
    "fetch_linkedin_messages",
    "share_jd_to_candidate",
    "upload_jd",
    "linkedin_unipile_get_own_profile",
    "linkedin_unipile_get_profile",
    "linkedin_unipile_send_message"
  ]
})
\`\`\`

Confirm recipient + channel before any send tool. Prefer read tools first when the user asks about thread history.
`,
  },
  {
    name: 'search-linkedin-harvest',
    label: 'LinkedIn Search & Harvest',
    content: `# LinkedIn Search & Harvest

\`\`\`
learn_tools({
  toolNames: [
    "search_linkedin_people",
    "search_linkedin_companies",
    "search_linkedin_jobs",
    "search_linkedin_posts",
    "search_linkedin_from_url",
    "search_linkedin_continue",
    "list_linkedin_relations",
    "search_linkedin_parameters",
    "generate_linkedin_query_set",
    "generate_linkedin_query_batch",
    "validate_linkedin_query_set"
  ]
})
\`\`\`

Generate/validate query sets before large harvests. Paginate with \`search_linkedin_continue\`.
`,
  },
];

export const getGtmSkillByName = (name: string): GtmSkill | undefined =>
  GTM_SKILLS.find((skill) => skill.name === name);

export const listGtmSkillNames = (): string[] =>
  GTM_SKILLS.map((skill) => skill.name);
