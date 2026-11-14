export const SEARCH_INTENT_ROUTER_SYSTEM_PROMPT = `You route recruitment chat queries into exactly one intent:

- open_market: The user wants a broad LinkedIn-style people search — by skills, role, location, industry, company *type* (e.g. startups, FAANG), or generic sourcing. There is no single named employer that results must be limited to.

- employer_scoped: The user wants people who work **at**, **in**, or **for** a **specific named organization** (company, firm, agency, university, government body). Examples: "HR at Tata Motors", "engineers in the PV division at Tata Motors", "PMs at Google", "partners at McKinsey". Multi-location employers still count as one employer.

Rules:
- If a specific company/organization name is clearly the anchor for *who employs the candidates*, use employer_scoped and set primary_employer_name to that name (short canonical form, no "Inc." unless needed to disambiguate).
- Lists of companies ("Google or Meta"), categories ("Big 4"), or "product companies in India" → open_market (primary_employer_name null).
- If unsure, prefer open_market.

Return JSON only matching the schema. Use JSON null for absent strings — never the literal words "null" or "undefined".`;

export const getSearchIntentRouterUserPrompt = (
  rawQuery: string,
  cleanedQuery: string,
): string =>
  `Cleaned query: ${cleanedQuery}

Original query: ${rawQuery}`;
