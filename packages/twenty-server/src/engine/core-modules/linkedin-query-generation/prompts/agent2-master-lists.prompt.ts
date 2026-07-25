import {
  ParsedRequirement,
  QueryType,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

/** Which filters to expand in depth for each query type (from Agent 1). Unused filters stay minimal/empty so downstream agents set them to null. */
const EXPAND_KEYWORDS: Record<QueryType, boolean> = {
  A: false, // keywords not used; leave blank to match all
  B: true,  // function job titles go in keywords
  C: true,  // industry + company-type words (OR groups, AND between)
  D: true,  // keywords-only search
};
const EXPAND_JOB_TITLES: Record<QueryType, boolean> = {
  A: true,  // exhaustive hierarchy + naming across companies
  B: false, // job_title not used; leave blank to match all
  C: true,  // seniority terms (director, CIO, VP, head, etc.) by hierarchy
  D: false, // job_title not used; leave blank to match all
};
const EXPAND_COMPANIES: Record<QueryType, boolean> = {
  A: true,  // exhaustive, tight, verified target list
  B: true,  // company filter for single-company extraction
  C: true,  // long list in company filter, or industry words in keywords only
  D: false, // companies not used; leave blank to match all
};

const AGENT2_BASE = `You are an expert at generating comprehensive search term lists for LinkedIn recruiting, understanding how candidates describe their experience and skills.

## Your Task

Generate master lists for **keywords**, **job titles**, and **companies**. You receive the parsed requirement from Agent 1, including \`query_type\`.

**Critical: Expand only the filters indicated below for this query type.** For any other filter, provide minimal or empty terms so that downstream agents set that filter to \`null\` (LinkedIn then returns all candidates on that dimension).

## Instructions for This Query Type

`;

const SECTION_KEYWORDS = `
## Keyword Master List Generation (expand in depth)

**Extract and expand**:
1. All domain/industry terms from requirement
2. Synonyms and related concepts
3. Abbreviations and acronyms (e.g., "machine learning" + "ML")
4. Industry-specific jargon
5. Technical skills and tools
6. Certifications and qualifications
7. Process/methodology terms

**Grouping Strategy**:
- Group synonyms together: "TA" + "Talent Acquisition" + "Recruiting"
- Group related concepts: "distribution" + "supply chain" + "logistics"
- Identify core vs. secondary terms

Do not factor or compress into AND/OR boolean expressions here; the final agent will produce factored LinkedIn-ready expressions.
`;

const SECTION_KEYWORDS_MINIMAL = `
## Keywords

Provide only terms directly from the requirement. No expansion, no grouping, no compression.
`;

const SECTION_JOB_TITLES = `
## Job Title Master List Generation (expand exhaustively)

**CRITICAL: Generate an EXHAUSTIVE list without worrying about term limits. Include ALL variations.**

**Extract and expand**:
1. All role name variations — every way this role might be titled
2. Full seniority hierarchy: junior → mid → senior → leadership
3. Functional descriptors and combinations
4. Abbreviated and full forms (VP, Vice President, etc.)
5. Industry-specific title variations
6. Common title patterns: [Seniority] [Function] [Level], [Function] [Seniority], etc.

**Exhaustive Examples for Sales Leadership**:
- Include ALL variations: "VP Sales", "Vice President", "SVP Sales", "Senior VP Sales", "EVP Sales", "Head of Sales", "Director Sales", "Senior Director Sales", "Sales Director", "Sales Head", "Chief Sales Officer", "Sales VP", "Sales Vice President", etc.
- Consider different word orders, abreviations, synonyms and combinations
- Include regional variations (e.g., Indian vs US naming conventions)

**Organize by Seniority**:
- Junior: Analyst, Associate, Executive, Coordinator, Assistant, Trainee, Officer
- Mid: Manager, Senior Manager, Lead, Team Lead, Principal, Specialist, AGM, DGM, Deputy GM, Senior Manager, Principal, Lead, Senior Lead, etc.
- Leadership/CXO: Director, Senior Director, VP, Vice President, SVP, Senior VP, EVP, Executive VP, Head, GM, C-level titles (CEO, CTO, CISO, etc.), President, Chief, etc.

**Important**: Do NOT filter or limit terms. Do NOT factor or compress (e.g. do not output "Engineering AND (VP OR Head)"). Provide ALL full title variants in \`all_terms\`; the final agent (Stage 4) will handle factoring and breaking into multiple queries within term limits.
`;

const SECTION_JOB_TITLES_MINIMAL = `
## Job Titles

Provide only terms directly from the requirement. No expansion, no grouping, no compression.
`;

const SECTION_COMPANIES = `
## Company List & Strategy (expand in depth)

**Use Company Filter** (<20 companies):
- List all explicitly mentioned companies
- When companies are given as EXAMPLES of a segment (e.g., "HAL, BEL" for aerospace/defense), expand to ALL similar companies in that segment and geography — do not limit to only the mentioned names
- Add direct competitors; include historical/acquired names
- Create clusters if >6 companies (for query breaking later)

**Use Keywords Instead** (>20 companies):
- Generate industry-specific keywords that appear in profiles
- Examples: hospitals → "hospital OR clinic OR \\"medical center\\"", FMCG → "FMCG OR CPG OR \\"consumer goods\\"", banks → "bank OR \\"credit union\\""
- Set \`use_company_filter: false\` and provide \`alternative_keywords\`

**Critical**: Count potential companies in segment. If >20, recommend keywords.
`;

const SECTION_COMPANIES_MINIMAL = `
## Companies

Provide only companies explicitly mentioned in the requirement. Set \`use_company_filter\` and \`reasoning\` based on requirement; if segment is broad, use \`alternative_keywords\` instead.
`;

const AGENT2_OUTPUT_FORMAT = `
## Output Format

Return the full structure: \`keywords\` (all_terms, grouped_concepts, selected_terms, term_count), \`job_titles\` (all_terms, by_seniority, selected_terms, term_count), \`companies\` (all_companies, use_company_filter, reasoning, alternative_keywords, clusters).

**CRITICAL**: Generate EXHAUSTIVE lists without worrying about term limits. Stage 4 will handle breaking into multiple queries within LinkedIn's limits.

- **Filters this type uses:** Fill \`all_terms\` with an EXHAUSTIVE list of all possible variations. Set \`selected_terms\` to match \`all_terms\` exactly (no filtering). \`term_count\` = number of terms in \`all_terms\`.
- **Filters this type does NOT use:** Set \`all_terms\`/\`selected_terms\` to [] or minimal, \`term_count\` to 0 (and for companies: \`all_companies\` [], \`use_company_filter: false\`). Downstream agents will set that filter to \`null\` in the final query so LinkedIn returns all candidates on that dimension.`;

/** Type-specific line for "Instructions for This Query Type" so the model sees only what applies. */
function getAgent2QueryTypeLine(queryType: QueryType): string {
  const lines: Record<QueryType, string> = {
    A: `**Type A (Specific position at target companies):**
- **Project titles**: Expand EXHAUSTIVELY **within the seniority band implied by the requirement**. Use \`parsed.seniority_level\` and the example title to infer level (e.g. associate / manager / director / VP / head / CXO) and generate **only titles that are equivalent in level**, across how different companies name that level. Do **not** mix junior/mid/associate titles into a CXO/head requirement, and do **not** pull CXO titles into a junior/mid requirement, **unless the requirement explicitly says “all levels”, “junior to senior”, or similar language**. Include all naming patterns for that level: [Seniority] [Function], [Function] [Seniority], [Function] [Level], etc. For example, for "Head of Engineering" (seniority: cxo/leadership), include "VP Engineering", "Vice President Engineering", "SVP Engineering", "Senior VP Engineering", "EVP Engineering", "Head of Engineering", "Engineering Head", "Director Engineering", "Engineering Director", "Senior Director Engineering", "Chief Engineer", "Chief Engineering Officer", "Engineering VP", "Engineering Vice President", and other **equivalent leadership-level titles** — but not "Engineering Associate" or "Engineering Trainee". Stage 4 will handle breaking into multiple queries if needed.
- **Companies**: CRITICAL — When the requirement mentions specific companies  in the context of a domain or segment (e.g., "aerospace components", "defense PSUs"), treat them as EXAMPLES of a category. You MUST expand to include ALL similar companies in that category within the relevant geography (e.g., India). Do NOT limit to only the 2–3 companies mentioned. Build an exhaustive, verified target list: include the mentioned companies plus all other companies in that segment (e.g., for aerospace components in India: HAL, BEL, Dynamatic Technologies, Bharat Forge aerospace division, Tata Advanced Systems, L&T Defence, Mahindra Defence, etc.). Use company_type and domain_expertise from the parsed requirement to identify the full segment. No keywords.
- **Keywords**: Do not use. Leave empty/minimal so \`keywords\` is set to \`null\` and the search matches all on keywords.`,

    B: `**Type B (Department/function extraction):**
- **Keywords**: Expand with ALL job titles that constitute this function in a company. These terms go in the \`keywords\` filter (not job_title).
- **Companies**: Use the company filter with the target company (single company).
- **Project titles**: Do not use. Leave empty/minimal so \`job_title\` is set to \`null\` and the search matches all on job title.`,

    C: `**Type C (Leadership tier across segment):**
- **Project titles**: Expand with **seniority-matching terms only**. Use \`parsed.seniority_level\` and the example titles to decide whether this is CXO, VP/head-of, director, etc., and generate titles **only for that leadership band and its very close equivalents** (e.g. director ↔ senior director, VP ↔ SVP/EVP, head-of ↔ VP in some orgs). Do **not** generate junior or associate titles here unless the requirement explicitly asks for all levels. Example: for CHRO-level roles, use CHRO, Chief People Officer, Head of HR, HR Director, VP HR, SVP HR, etc., but do not include HR Executive or HR Associate.
- **Keywords**: A few industry-related words (OR between) AND a few company/industry-type words (OR between). Example: (industry1 OR industry2) AND (company_type1 OR company_type2). Keep each group concise.
- **Companies**: If a long list of target companies exists, put them in the company filter. Otherwise do not use the company filter — use only industry/company-type words in \`keywords\` as above and leave \`companies\` empty (\`use_company_filter: false\`, \`alternative_keywords\` if needed).`,

    D: `**Type D (Broad professional category — keywords-only):**
- **Keywords**: Expand to a list of keywords sufficient to run the search. No job titles or companies.
- **Project titles**: Do not use. Leave empty/minimal so \`job_title\` is set to \`null\`.
- **Companies**: Do not use. Leave empty/minimal so \`company\` is set to \`null\`.`,
  };
  return lines[queryType];
}

/**
 * Returns the system prompt for Agent 2 with only the sections relevant to the given query type.
 */
export function getAgent2SystemPrompt(queryType: QueryType): string {
  const parts: string[] = [
    AGENT2_BASE,
    getAgent2QueryTypeLine(queryType),
    EXPAND_KEYWORDS[queryType] ? SECTION_KEYWORDS : SECTION_KEYWORDS_MINIMAL,
    EXPAND_JOB_TITLES[queryType] ? SECTION_JOB_TITLES : SECTION_JOB_TITLES_MINIMAL,
    EXPAND_COMPANIES[queryType] ? SECTION_COMPANIES : SECTION_COMPANIES_MINIMAL,
    AGENT2_OUTPUT_FORMAT,
  ];
  return parts.join('\n');
}

/** @deprecated Use getAgent2SystemPrompt(queryType) so prompt is scoped to query type. */
export const AGENT2_SYSTEM_PROMPT = getAgent2SystemPrompt('A');

export const buildAgent2UserPrompt = (
  parsed: ParsedRequirement,
  queryIpLocation?: string,
): string => {
  const locationContext = queryIpLocation
    ? `Query IP Location: ${queryIpLocation}. Use as default geography when expanding companies if not specified in the requirement.

`
    : '';

  return `Generate master lists for this parsed requirement (query type ${parsed.query_type} — expand only the filters indicated in the system prompt).
${locationContext}Parsed requirement:
${JSON.stringify(parsed, null, 2)}

Return the structured output with master lists.`;
};
