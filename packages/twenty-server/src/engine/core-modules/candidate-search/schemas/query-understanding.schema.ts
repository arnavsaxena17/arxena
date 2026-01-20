import { z } from 'zod';
import { companyTypeSignalsSchema, jobTitleDiscoverySchema } from './discovery.schemas';

/**
 * Certification requirement schema
 */
export const certificationSchema = z.object({
  name: z.string().describe('Name of the certification (e.g., "ISO 9001", "US GAAP", "FDA")'),
  type: z.string().nullable().describe('Type of certification (e.g., "quality", "financial", "regulatory")'),
  required: z.boolean().describe('Whether this certification is required or preferred'),
});

/**
 * Company size range schema
 */
export const companySizeRangeSchema = z.object({
  min: z.number().nullable().describe('Minimum employee count'),
  max: z.number().nullable().describe('Maximum employee count'),
  description: z.string().nullable().describe('Descriptive size (e.g., "5000+", "mid-sized", "large")'),
});

/**
 * Age constraint schema (mapped to graduation year)
 */
export const ageConstraintSchema = z.object({
  maxAge: z.number().nullable().describe('Maximum age in years'),
  minAge: z.number().nullable().describe('Minimum age in years'),
  graduationYearRange: z.object({
    min: z.number().nullable().describe('Minimum graduation year (inferred from maxAge)'),
    max: z.number().nullable().describe('Maximum graduation year (inferred from minAge)'),
  }).nullable().describe('Graduation year range inferred from age constraints'),
});

/**
 * Target company profile for like-to-like matching
 */
export const targetCompanyProfileSchema = z.object({
  industry: z.string().nullable().describe('Target industry for like-to-like matching'),
  companySize: companySizeRangeSchema.nullable().describe('Target company size range'),
  companyType: z.string().nullable().describe('Company type (e.g., "manufacturing", "services")'),
  similarCompetitors: z.array(z.string()).nullable().describe('List of similar competitor companies'),
});

export const patternIdentificationSchema = z.object({
  identifiedPatterns: z.object({
    specializedRole: z.object({
      detected: z.boolean().describe('Whether a specialized role pattern was detected'),
      confidence: z.number().min(0).max(1).describe('Confidence level (0-1) of the detection'),
      reasoning: z.string().nullable().describe('Explanation of why this pattern was detected'),
    }).describe('Pattern for specialized roles requiring job title discovery'),
    companyDescription: z.object({
      detected: z.boolean().describe('Whether a company description pattern was detected'),
      confidence: z.number().min(0).max(1).describe('Confidence level (0-1) of the detection'),
      description: z.string().nullable().describe('The company description extracted from the query'),
      reasoning: z.string().nullable().describe('Explanation of why this pattern was detected'),
    }).describe('Pattern for company descriptions requiring company discovery'),
    instituteRequirement: z.object({
      detected: z.boolean().describe('Whether an institute requirement pattern was detected'),
      confidence: z.number().min(0).max(1).describe('Confidence level (0-1) of the detection'),
      instituteType: z.string().nullable().describe('Type of institute mentioned (e.g., "tier-1", "IIT", "IIM")'),
      reasoning: z.string().nullable().describe('Explanation of why this pattern was detected'),
    }).describe('Pattern for educational institute requirements requiring institute discovery'),
    industryRequirement: z.object({
      detected: z.boolean().describe('Whether an industry requirement pattern was detected'),
      confidence: z.number().min(0).max(1).describe('Confidence level (0-1) of the detection'),
      industryDescription: z.string().nullable().describe('The industry description extracted from the query (e.g., "pharmaceutical", "technology", "manufacturing")'),
      reasoning: z.string().nullable().describe('Explanation of why this pattern was detected'),
    }).describe('Pattern for industry requirements requiring industry discovery'),
    reportingStructureRequirement: z.object({
      detected: z.boolean().describe('Whether a reporting structure requirement pattern was detected'),
      confidence: z.number().min(0).max(1).describe('Confidence level (0-1) of the detection'),
      reasoning: z.string().nullable().describe('Explanation of why this pattern was detected'),
    }).describe('Pattern for reporting structure requirements requiring reporting structure discovery'),
  }).describe('All patterns identified in the query'),
});

/**
 * Zod schema for query understanding
 */
export const queryUnderstandingSchema = z.object({
  primaryRole: z.string().describe('The primary job title or role being searched'),
  functionalRole: z.enum(['sales', 'marketing', 'engineering', 'finance', 'hr', 'legal','it', 'operations', 'product', 'technology', 'customer_success', 'support', 'other', 'healthcare']).nullable().describe('Functional role being searched'),
  subFunctionalRole: z.string().nullable().describe('Sub-functional role (e.g., "Direct Sales", "Field Sales", "B2B Sales", etc.)'),
  hierarchicalLevel: z.enum(['entry', 'mid', 'leadership']).nullable().describe('Hierarchical level (e.g., "Entry", "Mid", "Leadership")'),
  subHierarchicalLevel: z.string().nullable().describe('Sub-hierarchical level (e.g., "Senior Manager", "Manager", "Assistant Manager")'),
  roleVariations: z.array(z.string()).describe('List of 5-10 common variations, synonyms, and related titles'),
  functionalRoleVariations: z.array(z.string()).describe('List of 5-10 common variations, synonyms, and related titles for the function aspect of the role. Eg. Sales, Business Development'),
  hierarchicalLevelVariations: z.array(z.string()).describe('List of 5-10 common variations, synonyms, and related titles for the hierarchical level aspect of the role. Eg. VP, Vice President, Head, Director, President, Sr. VP, EVP, AVP, etc.'),
  industry: z.array(z.string()).nullable().describe('Specific industries mentioned (use exact LinkedIn industry names)'),
  locationHierarchy: z.object({
    primary: z.string().describe('Most specific location mentioned (city/state)'),
    secondary: z.array(z.string()).nullable().describe('Additional locations mentioned'),
    regional: z.string().nullable().describe('Regional context (e.g., "NCR" includes Noida, Gurgaon)'),
  }).describe('Location hierarchy from most specific to broadest'),
  companyPreferences: z.object({
    current: z.array(z.string()).nullable().describe('Current companies explicitly mentioned'),
    past: z.array(z.string()).nullable().describe('Past companies if relevant'),
    types: z.array(z.string()).nullable().describe('Company types (startup, MNC, etc.)'),
  }).nullable().describe('Company preferences and requirements'),
  domainContext: z.string().nullable().describe('Domain context (SaaS, FMCG, Pharma, BFSI, etc.)'),
  skills: z.array(z.string()).nullable().describe('Specific skills or technologies mentioned'),
  experienceRequirements: z.string().nullable().describe('Experience requirements (years, specific experience types)'),
  explicitRequirements: z.array(z.string()).describe('Explicit requirements that must be met'),
  preferredRequirements: z.array(z.string()).describe('Preferred requirements (nice-to-have)'),
  needsClarification: z.boolean().describe('Whether the query needs clarification from the user before generating search parameters'),
  clarificationQuestions: z.array(z.string()).nullable().describe('Array of specific questions to ask the user to clarify ambiguous requirements'),
  clarificationAnswers: z.string().nullable().describe('User responses to clarification questions (provided when isClarificationResponse is true)'),
  ambiguityReasons: z.array(z.string()).nullable().describe('Reasons why clarification is needed (e.g., missing location, vague role description, conflicting requirements)'),
  ambiguityReasoning: z.string().nullable().describe('Detailed explanation of the ambiguity assessment'),
  detectedIssues: z.object({
    missingLocation: z.boolean().describe('Whether location information is missing'),
    vagueRoleDescription: z.boolean().describe('Whether the role description is too generic'),
    missingIndustry: z.boolean().describe('Whether industry information is missing when needed'),
    conflictingRequirements: z.boolean().describe('Whether there are conflicting requirements (e.g., entry level with significant experience)'),
    insufficientContext: z.boolean().describe('Whether there is insufficient context to proceed'),
  }).nullable().describe('Specific issues detected in the query'),
  companySizeRange: companySizeRangeSchema.nullable().describe('Company size requirements (employee count ranges or descriptive terms like "5000+", "mid-sized")'),
  fundingStage: z.array(z.string()).nullable().describe('Funding stages mentioned (e.g., "Series A", "Series B+", "PE-backed", "unicorn", "startup")'),
  ageConstraint: ageConstraintSchema.nullable().describe('Age constraints (can be mapped to graduation year range if needed)'),
  certifications: z.array(certificationSchema).nullable().describe('Certifications required or preferred (e.g., ISO, US GAAP, FDA, CE mark)'),
  regulatoryExperience: z.array(z.string()).nullable().describe('Regulatory experience requirements (e.g., "USFDA", "RBI", "RERA", "ISO certifications")'),
  companyGroupPreferences: z.array(z.string()).nullable().describe('Company groups mentioned (e.g., "Tata group", "Birla group") - these need to be expanded to subsidiaries'),
  targetCompanyProfile: targetCompanyProfileSchema.nullable().describe('Target company profile for like-to-like matching (exact competitor, similar size, similar type)'),
  patternIdentification: patternIdentificationSchema.nullable().describe('Pattern identification results from LLM analysis'),
  companyCulture: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']).nullable().describe('Company culture type (promoter-driven, family-run, MNC, etc.)'),
  reportingStructureRequirements: z.object({
    reportsTo: z.string().nullable().describe('Who the role reports to (e.g., "CEO", "MD")'),
    manages: z.array(z.string()).nullable().describe('Roles that report to this position'),
  }).nullable().describe('Reporting structure requirements'),
  locationFallbackStrategy: z.object({
    primary: z.string().describe('Primary location'),
    fallbackLocations: z.array(z.string()).describe('Fallback locations in priority order'),
    priority: z.array(z.number()).nullable().describe('Priority order for fallback locations'),
  }).nullable().describe('Location fallback strategy with priority ordering'),
  companyTypeSignals: companyTypeSignalsSchema.nullable().optional().describe('Company type signals extracted during discovery (industry keywords, product keywords, business model keywords, etc.)'),
  discoveredTitles: jobTitleDiscoverySchema.nullable().optional().describe('Discovered job titles with variations, hierarchical terms, and domain terms from discovery service'),
});

export type QueryUnderstanding = z.infer<typeof queryUnderstandingSchema>;

