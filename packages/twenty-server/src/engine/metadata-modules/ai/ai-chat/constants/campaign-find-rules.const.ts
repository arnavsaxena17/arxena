// The campaign page's rules for Find: writing target companies / people to
// the Companies and People tabs (ephemeral, not CRM). Always sent with the
// campaign context; the act-on-rows rules live in OUTREACH_ACTION_RULES.

export const CAMPAIGN_FIND_RULES: string[] = [
  //   'Target companies on the Companies tab are ephemeral (Find destination), not CRM membership.',
  //   'When the user asks to find/fetch/add/build target companies:',
  //   '1. load_skills(["sourcing"]) with sections: ["companies"]',
  //   '2. Search providers per the sourcing skill (Bright Data default)',
  //   '3. Write to the Companies tab before ending the turn: pass projectId on the search (Bright Data, Apollo, LinkedIn, index, Wikidata, Exa). The search writes the tab; a project is required, so ask which project before searching if it is missing.',
  //   'Do NOT create CRM Company records for the Companies tab. Only create CRM Company when Save to CRM / enrolling people.',
  //   'Target people on the People tab are ephemeral (Find) until the user selects rows and confirms Add to CRM / Enroll.',
  //   'When the user asks to find/fetch/search people (target titles, MD/CEO, personas) for this campaign:',
  //   '1. load_skills(["sourcing"]) with sections: ["people"] (or ["people-by-company"] when employers are already named)',
  //   '   If the companies are named, including a set you confirmed with the user (an ask_questions answer that picks the employers), switch to people-by-company and call find_people_by_company with those companies. Do not put employer names into a search_bright_data_business people query.',
  //   '   "Top" or "best" institutions of a kind in a place ("top hospitals in Mumbai") are a known set: name up to 12 from what you know, confirm them in one ask_questions, then call find_people_by_company. Do not run a population or company search for them, and never drop "top" to get more matches.',
  //   '2. Search using companies from this project when relevant',
  //   '3. Write to the People tab before ending the turn: pass projectId on the search. The search writes the tab; a project is required, so ask which project before searching if it is missing.',
  //   'Do NOT create_candidate / create_one_person / create_one_candidate for the People tab. CRM Candidate writes only after explicit user confirmation.',
];

export const introLead = '';
//   intro === 'mcp'
//     ? `You have access to ${filteredCatalog.length} tools via \`learn_tools\` / \`execute_tool\`. They are NOT bound as top-level MCP tools.
// Construct CRUD names from the grammar below. Load a skill for GTM/workflow/metadata tool names.`
//     : `You have access to ${filteredCatalog.length} tools. Some are pre-loaded and ready to use immediately.
// To use any other tool, first call \`${LEARN_TOOLS_TOOL_NAME}\` to learn its schema, then call \`${EXECUTE_TOOL_TOOL_NAME}\` to run it.`;
