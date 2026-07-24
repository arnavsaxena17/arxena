import { ParsedRequirement } from '../schemas/parsed-requirement.schema';

export const REQUIREMENT_ANALYZER_SYSTEM_PROMPT = `You are a requirement parser for recruitment searches. Extract the following from the requirement:

1. role_function: What work is being performed (not the title, but the actual function)
2. primary_role_name: The role name mentioned in requirement
3. industries: Industry keywords mentioned
4. location: Geographic location
5. experience_range: {min, max} in years
6. age_range: {min, max} in years
7. salary_range: {min, max} in local currency
8. seniority_level: Junior/Mid/Manager/Senior/Head based on years & title
9. must_have_skills: Explicit skills/tools/domains mentioned
10. nice_to_have_skills: Implied skills based on role
11. company_type: Describe the exact type or category of or segment of companies (ensure that you include sub types) indicated in the requirement (e.g. Listed specialty chemicals companies based in India, Product based companies based in US, Law firms or corporate environments which are family run businesses, Startups). Try to not go too broad or too narrow too much from the requirement.
12. specific_companies: Named companies if mentioned (e.g., "Big 4", "McKinsey", etc.)
13. requires_company_targeting: Set to true ONLY when the requirement explicitly asks for candidates from a specific category or type of companies that would need to be expanded into a concrete list of company names (e.g. "Big 4", "FAANG", "product companies", "startups", "listed companies", "MBB consulting"). Set to false when the requirement is generic and can be satisfied with keyword, job title, skills, and location alone (e.g. "Python developer in Bangalore", "Senior PM with 5+ years"). When in doubt, prefer false—company expansion is only needed when the hirer clearly wants to target a defined set or category of companies.
14. requires_job_title_expansion: Set to false for broad or aggregate queries where we should NOT expand into many similar individual job titles (e.g. "all leadership positions", "all people at ACME Corp", "all engineering roles"). Set to true when the requirement is about a specific role (e.g. "Senior Backend Engineer", "Head of Marketing") and we want to expand into similar titles.
Return only valid JSON.`;

export const getRequirementAnalyzerUserPrompt = (
  rawQuery: string,
  cleanedQuery: string,
  parsedRequirement?: ParsedRequirement,
): string => {
  const parsedRequirementString = parsedRequirement
    ? `\n\nExisting parsed requirement (if any):\n${JSON.stringify(parsedRequirement, null, 2)}`
    : '';

  return `Parse this requirement:
Query IP Location: Mumbai, India. (This is only the location for the query IP, not the location for the candidates. Use it only for the country geography constraint for the query if its not provided in the query.)

Cleaned query: ${cleanedQuery}${parsedRequirementString}

Original query: ${rawQuery}`;
};

