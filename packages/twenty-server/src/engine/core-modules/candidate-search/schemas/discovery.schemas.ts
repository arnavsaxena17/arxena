import { z } from 'zod';
import { linkedinIndustryOptions } from './classic-people-search.schema';

// Define the industry enum from the valid LinkedIn industry options
const industryEnum = z.enum(linkedinIndustryOptions as [string, ...string[]]);

/**
 * Schema for company type signals extracted during company discovery
 */
export const companyTypeSignalsSchema = z.object({
  industryKeywords: z.array(z.string()).describe('Array of industry-specific terms (e.g., "OEM", "telecom equipment", "network solutions")'),
  productKeywords: z.array(z.string()).describe('Array of product/service keywords (e.g., "base stations", "switches", "routers")'),
  businessModelKeywords: z.array(z.string()).describe('Array of business model terms (e.g., "B2B", "enterprise solutions")'),
  companyTypeDescription: z.string().describe('Description of the company type'),
});

export type CompanyTypeSignals = z.infer<typeof companyTypeSignalsSchema>;

/**
 * Schema for company discovery results
 */
export const companyDiscoverySchema = z.object({
  companies: z.array(
    z.object({
      name: z.string().describe('Company name'),
      location: z.string().nullable().optional().describe('Company location (city/state/country)'),
      description: z.string().nullable().optional().describe('Brief company description'),
    })
  ).describe('List of discovered companies'),
  searchQuery: z.string().describe('The search query used for discovery'),
  companyTypeSignals: companyTypeSignalsSchema.nullable().optional().describe('Company type signals extracted during discovery (industry keywords, product keywords, business model keywords, etc.)'),
});

export type CompanyDiscoveryResult = z.infer<typeof companyDiscoverySchema>;

export const jobTitleDiscoverySchema = z.object({
  jobTitles: z.array(
    z.object({
      title: z.string().describe('Primary job title'),
      variations: z.array(z.string()).describe('List of variations, synonyms, and related titles'),
      hierarchicalTerms: z.array(z.string()).nullable().optional().describe('Hierarchical position terms including abbreviations (e.g., GM, VP, Vice President, President, AGM, Head, Director, Manager)'),
      domainTerms: z.array(z.string()).nullable().optional().describe('Domain/functional terms including abbreviations (e.g., Operations, Sales, Marketing, S&M, Plant, Unit, Works, Site, Manufacturing, Production, Supply Chain, SCM, Mktg, )'),
    })
  ).describe('List of discovered job titles with variations'),
  searchQuery: z.string().describe('The search query used for discovery'),
});

export type JobTitleDiscoveryResult = z.infer<typeof jobTitleDiscoverySchema>;

export const instituteDiscoverySchema = z.object({
  institutes: z.array(
    z.object({
      name: z.string().describe('Institute name'),
      type: z.string().describe('Institute type (e.g., "IIT", "IIM", "university", "college", "domain-specific")'),
      location: z.string().nullable().optional().describe('Institute location (city/state/country)'),
      domain: z.string().nullable().optional().describe('Domain specialization (e.g., "dairy", "chemical", "engineering")'),
      tier: z.string().nullable().optional().describe('Institute tier (e.g., "tier-1", "tier-2")'),
    })
  ).describe('List of discovered educational institutes'),
  searchQuery: z.string().describe('The search query used for discovery'),
});

export type InstituteDiscoveryResult = z.infer<typeof instituteDiscoverySchema>;
export const industryDiscoverySchema = z.object({
  industries: z.array(industryEnum).describe('List of discovered LinkedIn industry names that match the query'),
  searchQuery: z.string().describe('The search query used for discovery'),
});

export type IndustryDiscoveryResult = z.infer<typeof industryDiscoverySchema>;

/**
 * Schema for reporting structure discovery results
 * Simplified to only include direct reporting relationships (not the entire hierarchy chain)
 */
export const reportingStructureDiscoverySchema = z.object({
  reportingStructure: z.object({
    functionalHome: z.string().describe('Functional department/area where the role typically sits (e.g., "Sales", "Channel Sales", "Partner Sales", "Enterprise Sales")'),
    directReportingManager: z.object({
      title: z.string().describe('Job title of the direct reporting manager'),
      commonVariations: z.array(z.string()).nullable().optional().describe('Common variations of this title used across companies'),
      description: z.string().nullable().optional().describe('Description of the direct reporting relationship'),
    }).nullable().optional().describe('Direct reporting manager (level 1 only)'),
    dualReportingManagers: z.array(
      z.object({
        title: z.string().describe('Job title of the dual reporting manager'),
        type: z.string().describe('Type of dual reporting (e.g., "functional", "geographic", "matrix", "dotted line")'),
        commonVariations: z.array(z.string()).nullable().optional().describe('Common variations of this title'),
        description: z.string().nullable().optional().describe('Description of this dual reporting relationship'),
      })
    ).nullable().optional().describe('Additional reporting managers in matrix/dual reporting structures (common in MNCs)'),
    directReports: z.array(
      z.object({
        title: z.string().describe('Job title that directly reports to this role'),
        description: z.string().nullable().optional().describe('Description of this direct reporting relationship'),
      })
    ).nullable().optional().describe('Direct reports (level 1 only) - roles that report directly to this position'),
    commonReportingManagerTitles: z.array(z.string()).describe('Exact designations/titles to search for when looking for managers this role reports to (useful for LinkedIn searches). Include variations from directReportingManager and dualReportingManagers.'),
    regionalConsiderations: z.string().nullable().optional().describe('Regional or location-specific reporting patterns (e.g., "In Gujarat, many report to Mumbai-based managers")'),
    industryConsiderations: z.string().nullable().optional().describe('Industry-specific reporting patterns (e.g., "In Pharma sales structure, there may be a ASM, RSM, etc. but in Medical devices, there maybe a application specialist, etc.")'),
  }).describe('Simplified reporting structure discovery for the role - only direct relationships'),
  searchQuery: z.string().describe('The search query used for discovery'),
});

export type ReportingStructureDiscoveryResult = z.infer<typeof reportingStructureDiscoverySchema>;
