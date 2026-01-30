
const classicRules = `
  STRICT RULES FOR CLASSIC SEARCH

  6-Keyword Maximum Rule (Mandatory for Classic):
  The keywords field may contain maximum 6 Boolean terms.
  • Each quoted phrase counts as one term (e.g., "word1 word2" = 1 term).
  • Each unquoted word counts as one term (e.g., word1 = 1 term, word2 = 1 term).
  • Boolean operators (AND, OR, NOT) and parentheses do NOT count as terms.
  • The total number of terms inside the keywords string must never exceed 6.

  TERM COUNTING EXAMPLES:
  - "word1 word2" OR "word3 word4" = 2 terms ✓
  - ("word1 word2" OR "word3 word4" OR chro) = 3 terms ✓
  - ("word1 word2" OR "word3 word4" OR chro) AND manufacturing = 4 terms ✓
  - ("word1 word2" OR "word3 word4" OR "word5 word6" OR chro) AND (term1 OR term2) = 6 terms ✓
  - ("word1 word2" OR "word3 word4" OR "word5 word6" OR chro) AND (term1 OR term2 OR term3) NOT term4 = 7 terms ✗ (EXCEEDS LIMIT)

  LOCATION HANDLING FOR CLASSIC:
  • Extract location from keywords
  • Set in location array: ["Gujarat", "Ahmedabad"] (include all location variants)
  • Format: location: string[] | null

  VALIDATION REQUIRED:
  Before returning your response, count the terms in each query's keywords field.
  If any query exceeds 6 terms, you MUST split it further or simplify it.

  CLASSIC SPLITTING STRATEGY:
  Since Classic has the strictest term limit (6), you should:
  • Prioritize creating SINGLE comprehensive query when possible
  • Only split if keywords exceed 6 terms after location extraction
  • If splitting is required, split by:
    1. Seniority level (most reliable MECE axis)
    2. Role family (if distinct enough)
  • Keep splits minimal (2-3 queries max unless absolutely necessary)

  CLASSIC FIELD RULES:
  • keywords: Required, max 6 terms
  • location: Array of location strings (e.g., ["Gujarat", "Ahmedabad"])
  • company: Array of company names (only if specific companies mentioned)
  • school: Array of school names (only if specific schools mentioned)
  • industry: Use ONLY if specific narrow industry required (prefer keywords)
  • network_distance: Only include if user specifically requests connection level filtering
  • profile_language: Only if user specifies language requirement
  • All other fields: Set to null unless explicitly mentioned in requirement
`;


  
const salesNavRules = `
  STRICT RULES FOR SALES NAVIGATOR SEARCH
  
  9-Keyword Maximum Rule (Mandatory for Sales Navigator):
  The keywords field may contain maximum 9 Boolean terms.
  • Each quoted phrase counts as one term (e.g., "word1 word2" = 1 term).
  • Each unquoted word counts as one term (e.g., word1 = 1 term, word2 = 1 term).
  • Boolean operators (AND, OR, NOT) and parentheses do NOT count as terms.
  • The total number of terms inside the keywords string must never exceed 9.
  
  TERM COUNTING EXAMPLES:
  - "word1 word2" OR "word3 word4" OR "word5 word6" OR "word7 word8" = 4 terms ✓
  - ("word1 word2" OR "word3 word4" OR chro OR "VP HR") AND manufacturing = 5 terms ✓
  - ("word1 word2" OR "word3 word4" OR "word5 word6" OR chro) AND (term1 OR term2 OR term3 OR term4 OR term5) = 9 terms ✓
  - ("word1 word2" OR "word3 word4" OR "word5 word6" OR chro) AND (term1 OR term2 OR term3 OR term4 OR term5 OR term6) = 10 terms ✗ (EXCEEDS LIMIT)
  
  LOCATION HANDLING FOR SALES NAVIGATOR:
  • Extract location from keywords
  • Set in location object: { "include": ["Gujarat", "Ahmedabad"], "exclude": null }
  • Format: location: { include: string[] | null, exclude: string[] | null } | null
  
  VALIDATION REQUIRED:
  Before returning your response, count the terms in each query's keywords field.
  If any query exceeds 9 terms, you MUST split it further or simplify it.
  
  SALES NAVIGATOR SPLITTING STRATEGY:
  With 9 term limit (more flexible than Classic), you should:
  • Aim for comprehensive single query when possible
  • Split only when:
    1. Keywords exceed 9 terms after location extraction
    2. Multiple distinct seniority levels exist (C-suite vs VP vs Manager)
    3. Multiple distinct role families exist
  • Keep splits to 2-4 queries unless requirement is very broad
  
  SALES NAVIGATOR FIELD RULES:
  • keywords: Required, max 9 terms
  • location: Object with include/exclude arrays
  • company: Object with include/exclude arrays (only if specific companies mentioned)
  • industry: Object with include/exclude arrays (ONLY if specific narrow industry required)
  • seniority: Object with include/exclude arrays (use if requirement mentions specific levels)
  • company_headcount: Array of size ranges (only if size requirement mentioned)
  • tenure_at_company: Array of tenure ranges (only if experience requirement mentioned)
  • DO NOT populate these unless explicitly mentioned:
    - saved_search_id, recent_search_id (no dummy values)
    - first_name, last_name (only if searching for specific person)
    - network_distance (only if user specifies connection level)
    - persona, account_lists, lead_lists (only if user mentions them)
    - All engagement fields (following_your_company, viewed_profile, etc.) should be null
  `;
  

const recruiterRules = `
  STRICT RULES FOR RECRUITER SEARCH

  For Recruiter searches, there is no strict keyword term limit, but still optimize for clarity and effectiveness.

  LOCATION HANDLING FOR RECRUITER:
  • Extract location from keywords
  • Set in location array as objects: [{ "id": "Gujarat", "priority": "MUST_HAVE", "scope": "CURRENT" }]
  • Format: Array of location objects with id, priority, and scope
  • Priority: Use "MUST_HAVE" for required locations, "CAN_HAVE" for preferred
  • Scope: "CURRENT" for current location, "CURRENT_OR_OPEN_TO_RELOCATE" for broader search

  RECRUITER SPLITTING STRATEGY:
  Since Recruiter has no term limit, you should:
  • Strongly prefer SINGLE comprehensive query unless requirement is very broad
  • Only split if:
    1. Multiple distinct seniority levels that would benefit from separate searches
    2. Very broad requirement covering multiple unrelated role families
    3. User explicitly requests separate searches for different segments
  • Typical use case: 1-2 queries maximum

  RECRUITER FIELD RULES:
  • keywords: Required, no term limit
  • location: Array of location objects with id/priority/scope
  • role: Array of role objects (can use id or keywords) - use when specific titles mentioned
  • skills: Array of skill objects (can use id or keywords) - use when specific skills mentioned
  • company: Array of company objects (can use id or keywords) - only if specific companies mentioned
  • seniority: Object with include/exclude arrays - use if requirement mentions levels
  • company_headcount: Array of size ranges (only if size mentioned)
  • DO NOT populate these unless explicitly mentioned:
    - saved_search, saved_filter (no dummy values)
    - first_name, last_name (only if searching for specific person)
    - network_distance (only if user specifies connection level)
    - All activity/spotlight fields should be null unless specifically requested
    - hiring_projects, recruiting_activity (only if user mentions them)
`;

  



const basePrompt = `
  Interpret a natural-language LinkedIn People search strategy and generate multiple search queries that produce mutually exclusive, cumulatively exhaustive (MECE) search results.

  MECE refers to the search results, not the query structure.

  Your job:
  Create multiple queries where:
  • Candidates do not appear in more than one query (mutual exclusivity).
  • All relevant candidates appear in at least one of the queries (cumulatively exhaustive).
  • Each boolean query should provide a distinct set of candidates who are extremely relevant to the user requirement.
  • Each query must comply with LinkedIn People Search limitations.
  • Do not use boolean wildcards (*) for boolean queries.

  CRITICAL FIELD RULES:
  1. NEVER populate fields with dummy/placeholder values
  2. ONLY include fields that have real, actionable values from the user's requirement
  3. Fields to NEVER auto-populate with dummy data:
    - saved_search_id (only if user mentions a specific saved search)
    - recent_search_id (only if user references a recent search)
    - first_name, last_name (only if user specifies a person's name)
    - persona (only if user mentions specific personas)
    - account_lists, lead_lists (only if user specifies list names)
    - Any ID fields should be null unless you have real values

  LOCATION EXTRACTION (CRITICAL):
  When the boolean query contains location terms:
  • ALWAYS extract location terms from the keywords string
  • Set them in the location parameter/field (format depends on search type)
  • Remove location terms completely from the keywords string
  • This reduces keyword term count and uses native LinkedIn location filtering
  • Example: If boolean is "(manager OR director) AND telecom AND (Gujarat OR Ahmedabad)"
    → keywords: "(manager OR director) AND telecom"
    → location: varies by search type (see below)

  INDUSTRY FILTER USAGE:
  • Do NOT use industry filters unless the requirement specifically mentions a narrow industry segment
  • If a sector is mentioned (e.g., "manufacturing", "telecom"), treat it as a KEYWORD, not an industry filter
  • Keywords are more flexible and match against profile content, while industry filters are rigid
  • Only use industry filters when the user explicitly needs to filter by LinkedIn's predefined industry taxonomy

  MECE SPLITTING STRATEGY:
  Split queries based on attributes candidates reliably self-report:
  • Title/role synonym clusters (BEST for mutual exclusivity)
  • Seniority levels (C-level vs VP vs Director vs Manager)
  • Distinct role families (Sales vs Operations vs Engineering)
  • Company size buckets (if relevant)
  • Geographic clusters (if multiple distinct regions)

  DO NOT split by:
  • Company names (unless <10 specific target companies)
  • Industry variations (keep as keywords instead)
  • Minor keyword variations that don't change the candidate pool
  • Arbitrary subdivisions that don't create true mutual exclusivity

  EFFECTIVE SPLITTING EXAMPLES:

  ❌ BAD SPLIT (Not mutually exclusive):
  Query 1: "channel manager" AND telecom
  Query 2: "partner manager" AND telecom
  Query 3: "channel manager" AND nokia
  → Problem: Same candidates appear across multiple queries

  ✅ GOOD SPLIT (Mutually exclusive by seniority):
  Query 1: ("VP" OR "director") AND channel AND telecom
  Query 2: ("manager" OR "lead") AND channel AND telecom
  → Benefit: Senior vs mid-level creates clean separation

  ✅ GOOD SPLIT (Mutually exclusive by role family):
  Query 1: channel AND partner AND telecom
  Query 2: distribution AND alliances AND telecom
  → Benefit: Different role families, minimal overlap

  ❌ BAD SPLIT (Unnecessary fragmentation):
  Query 1: channel AND nokia
  Query 2: channel AND ericsson
  Query 3: channel AND cisco
  → Problem: Company-based splits only useful if targeting specific companies

  WHEN TO CREATE MULTIPLE QUERIES:
  • Term limit forces it (see search-type specific rules below)
  • Multiple distinct seniority levels (C-suite + VP + Manager)
  • Multiple distinct role families (Sales + Marketing + Operations)
  • Geographic split makes sense (North vs South, or specific metro clusters)

  WHEN TO USE SINGLE QUERY:
  • Boolean string fits within term limits
  • All variations are synonyms of the same role
  • Single geographic region
  • Company mentions are examples, not exhaustive targets
`;



const parameterGenerationInputFormat = `
  INPUT FORMAT:
  You will receive:
  - Raw Input: The original user query
  - Final Boolean String: A comprehensive boolean query string generated from the requirement
  - Boolean Query Summary: Key boolean components (job titles, industry, skills, mandatory, location)
  - Discovered Job Titles: Additional job title variations discovered via web/discovery
  - Discovered Companies: Company names discovered via web/discovery or query analysis

  Your task is to interpret the final boolean string and generate multiple MECE search parameter sets that can be used to fetch LinkedIn search results.

  OUTPUT FORMAT:
  Return a JSON object with:
  {
    "results": [array of parameter objects based on search type],
    "reasoning": "Brief explanation of your MECE splitting strategy and why you chose this approach"
  }

  CRITICAL REMINDERS:
  1. ALWAYS extract location from keywords and set in appropriate location field/parameter
  2. Count terms carefully before returning - never exceed limits
  3. NEVER populate fields with dummy/placeholder values
  4. Only split into multiple queries when truly necessary for MECE or term limits
  5. Prefer keywords over industry filters unless specifically required
  6. Each query should target a distinct, non-overlapping candidate segment
`


export const parameterGenerationPrompt = (searchType: 'classic' | 'sales_navigator' | 'recruiter'): string => {
    let searchTypeRules = '';
    if (searchType === 'classic') {
      searchTypeRules = classicRules;
    } else if (searchType === 'sales_navigator') {
      searchTypeRules = salesNavRules;
    } else {
      searchTypeRules = recruiterRules;
    }

    const parameterGenerationPrompt = `
    ${basePrompt}
    ${searchTypeRules}
    ${parameterGenerationInputFormat}
    `;
    return parameterGenerationPrompt;
  };