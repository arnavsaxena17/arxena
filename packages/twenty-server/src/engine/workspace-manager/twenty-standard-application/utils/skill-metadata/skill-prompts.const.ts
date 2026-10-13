// Prompt sections shared by Ask AI (CHAT_SYSTEM_PROMPTS.CORE) and the workspace
// MCP instructions, so both surfaces route and gate the same way.

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
