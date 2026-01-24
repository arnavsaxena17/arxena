export const comprehensiveBooleanQueryGenerationSystemPrompt = (searchType: 'classic' | 'sales_navigator' | 'recruiter'): string => {
    return `
    
    Generate a comprehensive but compact Boolean search string for requirement below:
    Follow these rules:
    Expand all relevant concepts: 
    • Job titles (job title equivalents, job title variations across companies for similar role/ scope of work, synonyms, alternate spellings) 
    • Industry terms and synonyms 
    • Functional or skill‑based keywords (include only if they are commonly mentioned in candidate profiles)
    • Do not use boolean wildcards (*) in strings.

    After expanding terms, compress and group them efficiently: 
    • Combine similar keywords using shared stems or logical nesting 
    • Avoid listing many near‑duplicates separately 
    • Do not use * wildcard in the boolean string
    • Use patterns like (chemical AND (manufacturing OR plant OR specialty OR bulk OR process)) instead of long OR chains 
    • Use job‑title stems where appropriate, such as (plant AND (head OR manager OR incharge)) or (manufacturing AND (head OR manager OR director))

    Avoid unnecessary over‑filtering: 
    • Do not include filtering keywords that candidates typically omit although the query might ask for it
    • Keep the search broad but highly targeted as per the query

    Output only the final Boolean string with: 
    • OR for synonyms 
    • AND for major requirement groups 
    • Grouped and compressed keyword blocks to minimize total characters`;
  } 


//   export const comprehensiveBooleanQueryGenerationSystemPrompt = (searchType: 'classic' | 'sales_navigator' | 'recruiter'): string => {
//     return `
//   # Enhanced Boolean Search String Generation for LinkedIn
  
//   ## Mission
//   Generate a **profile-realistic, concise, and effective** Boolean search string that matches candidates who would ACTUALLY show up in LinkedIn search results.
  
//   ## Critical Constraints
  
//   ### 1. Profile Reality Filter
//   **Only use keywords that candidates genuinely include in their LinkedIn profiles:**
  
//   ✅ **High-probability keywords (USE THESE):**
//   - Job titles and hierarchical levels: "director", "head", "vp", "manager", "lead"
//   - Functional areas: "sales", "marketing", "operations", "manufacturing", "engineering"
//   - Technical/specialized terms: "SAP", "Oracle", "cardiology", "machine learning", "Java"
//   - Specific industries: "pharma", "biotech", "telecom", "automotive"
//   - Role-specific terms: "channel", "partner", "alliances", "distribution"
  
//   ❌ **Low-probability keywords (AVOID THESE):**
//   - Generic descriptors: "B2B", "enterprise", "corporate", "strategic"
//   - Aspirational terms: "innovative", "dynamic", "leader"
//   - Implicit attributes: "revenue-focused", "growth-oriented"
//   - Common sense qualifiers: "experienced", "skilled"
  
//   ### 2. Industry Mapping Reality
//   - Functional roles are often tagged by company industry, NOT function
//   - Example: CFO at Airtel → profile shows "Telecommunications", not "Finance"
//   - Example: Head of Sales at Deloitte → profile shows "Consulting", not "Sales"
//   - **Implication**: Use industry terms cautiously; prefer company names + job titles
  
//   ### 3. Boolean String Structure
  
//   **Optimal Pattern:**
//   \`\`\`
//   (job_title_variations) AND (company_or_industry_if_distinctive) AND (location_if_needed)
//   \`\`\`
  
//   **Job Title Block** (Primary - 70% of search power):
//   - Combine hierarchical + functional terms
//   - Example: \`((head OR director OR vp) AND (channel OR partner OR alliances))\`
//   - Include synonyms and common variations
//   - Use nested grouping for clarity
  
//   **Company/Industry Block** (Secondary - use when specific):
//   - Company names: When <20 specific companies identifiable
//   - Industry terms: Only if distinctive and commonly listed
//   - Example: \`(ericsson OR nokia OR cisco OR huawei)\` is better than \`telecom equipment\`
  
//   **Location Block** (Tertiary - when geographic filter needed):
//   - Include major cities within regions
//   - Example: \`(Gujarat OR Ahmedabad OR Vadodara OR Surat)\`
  
//   ${searchType === 'classic' ? `
//   ### 4. CRITICAL: 6-Term Limit for Classic Search
  
//   **Term counting rules:**
//   - Each quoted phrase = 1 term: \`"sales manager"\` = 1 term
//   - Each unquoted word between operators = 1 term: \`sales OR manager\` = 2 terms
//   - Boolean operators (AND, OR, NOT) don't count as terms
//   - Parentheses don't count as terms
  
//   **Examples:**
//   - ✅ GOOD (5 terms): \`(head OR director) AND (sales OR channel) AND Gujarat\`
//   - ✅ GOOD (6 terms): \`("channel manager" OR "partner manager") AND (telecom OR pharma)\`
//   - ❌ BAD (9 terms): \`(head OR director OR vp) AND (sales OR channel OR partner) AND (telecom OR pharma OR networking)\`
  
//   **Term reduction strategies:**
//   1. Use quoted phrases to group: \`"channel manager"\` instead of \`channel AND manager\`
//   2. Combine with AND instead of OR chains: \`(director AND channel)\` vs \`(channel director OR channel head OR channel manager)\`
//   3. Move filters to structured fields (location, company, industry filters instead of keywords)
//   4. Prioritize most important terms only
//   ` : ''}
  
//   ### 5. Compression Techniques
  
//   **Use these patterns to stay concise:**
//   - Shared stems: \`(manufacturing AND (head OR director OR manager))\` vs long OR chain
//   - Nested logic: \`(channel AND (partner OR alliance OR distribution))\`
//   - Industry grouping: \`(telecom AND (equipment OR vendor OR OEM))\`
//   - Avoid redundancy: If searching "channel manager", don't also search "channel sales manager" separately
  
//   ### 6. Query Optimization Checklist
  
//   Before finalizing, verify:
//   - [ ] All keywords would ACTUALLY appear on target profiles
//   - [ ] No generic/aspirational terms (B2B, enterprise, strategic, etc.)
//   - [ ] Job title block is comprehensive with variations
//   - [ ] Industry terms are distinctive (not generic)
//   - [ ] ${searchType === 'classic' ? 'Total terms ≤ 6' : 'String is concise'}
//   - [ ] No wildcards (*) used
//   - [ ] Proper grouping with parentheses
//   - [ ] AND/OR operators used correctly
  
//   ## Output Format
  
//   Generate the following structured output:
  
//   \`\`\`json
//   {
//     "requirement": {
//       "raw_input": "<original user requirement>",
//       "interpreted_role_category": "<high-level role category>",
//       "industry_context": "<industry interpretation>",
//       "mandatory_elements": ["<list of must-have elements>"],
//       "optional_elements": ["<list of nice-to-have elements>"]
//     },
//     "keyword_expansion": {
//       "job_titles": {
//         "core_titles": ["<primary job titles>"],
//         "equivalent_titles": ["<synonyms and equivalents>"],
//         "senior_variants": ["<senior-level variants>"],
//         "mid_level_variants": ["<mid-level variants>"],
//         "alternate_spellings": ["<spelling variations>"]
//       },
//       "industry_terms": ["<only distinctive industry terms that appear on profiles>"],
//       "skills_keywords": ["<only technical/specialized skills commonly listed>"],
//       "excluded_terms": ["<terms to explicitly exclude if needed>"]
//     },
//     "boolean_components": {
//       "job_title_block": "<optimized job title boolean>",
//       "industry_block": "<industry/company boolean if applicable>",
//       "skills_block": "<technical skills boolean if applicable>",
//       "mandatory_block": "<any mandatory requirements boolean>",
//       "location_block": "<location boolean if applicable>",
//       "final_boolean_string": "<complete optimized boolean string>"
//     }
//   }
//   \`\`\`
  
//   ## Examples
  
//   ### Example 1: Channel Partner Managers (Classic Search - 6 term limit)
//   ❌ **Bad** (9 terms, generic keywords):
//   \`\`\`
//   (channel manager OR partner manager OR alliance manager) AND (telecom OR networking) AND (B2B OR enterprise) AND Gujarat
//   \`\`\`
  
//   ✅ **Good** (6 terms, profile-realistic):
//   \`\`\`
//   ("channel manager" OR "partner manager") AND (telecom OR nokia OR ericsson) AND Gujarat
//   \`\`\`
//   *Reasoning: Combined terms into phrases, removed "B2B"/"enterprise" (not on profiles), added specific companies*
  
//   ### Example 2: Senior Sales Leaders (Sales Navigator - More flexible)
//   ❌ **Bad** (generic, aspirational):
//   \`\`\`
//   (sales leader OR sales head) AND enterprise AND strategic AND B2B AND corporate
//   \`\`\`
  
//   ✅ **Good** (specific, hierarchical):
//   \`\`\`
//   ((head OR vp OR director OR president) AND (sales OR revenue OR "business development")) AND (pharma OR biotech OR healthcare)
//   \`\`\`
//   *Reasoning: Used hierarchical + functional combination, removed generic terms, used distinctive industry*
  
//   ### Example 3: Technical Consultants (Recruiter - Most filters)
//   ❌ **Bad** (too generic):
//   \`\`\`
//   consultant AND experienced AND strategic
//   \`\`\`
  
//   ✅ **Good** (specific technical):
//   \`\`\`
//   (consultant OR advisor) AND (SAP OR "Oracle ERP" OR "Microsoft Dynamics") AND (implementation OR integration)
//   \`\`\`
//   *Reasoning: Added technical specificity (SAP, Oracle) that appears on profiles, removed generic "experienced"*
  
//   ## Your Task
  
//   Analyze the provided user requirement and generate a comprehensive, profile-realistic Boolean search string following all guidelines above.
  
//   Focus on:
//   1. **Profile reality**: Only keywords candidates actually list
//   2. **Hierarchical + functional**: Combine levels with functions
//   3. **Conciseness**: ${searchType === 'classic' ? 'Maximum 6 terms for Classic' : 'Keep it tight'}
//   4. **Distinctiveness**: Specific > generic
//   5. **Multiple variations**: Cover different ways candidates describe same role
//   `;
//   };