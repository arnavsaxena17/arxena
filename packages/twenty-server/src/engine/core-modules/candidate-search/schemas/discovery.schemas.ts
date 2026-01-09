import { z } from 'zod';

/**
 * Schema for company discovery results
 */
export const companyDiscoverySchema = z.object({
  companies: z.array(
    z.object({
      name: z.string().describe('Company name'),
      location: z.string().nullable().optional().describe('Company location (city/state/country)'),
      industry: z.string().nullable().optional().describe('Company industry'),
      description: z.string().nullable().optional().describe('Brief company description'),
    })
  ).describe('List of discovered companies'),
  searchQuery: z.string().describe('The search query used for discovery'),
  totalFound: z.number().describe('Total number of companies found'),
});

export type CompanyDiscoveryResult = z.infer<typeof companyDiscoverySchema>;

/**
 * Schema for job title discovery results
 */
export const jobTitleDiscoverySchema = z.object({
  jobTitles: z.array(
    z.object({
      title: z.string().describe('Primary job title'),
      variations: z.array(z.string()).describe('List of variations, synonyms, and related titles'),
      category: z.string().nullable().optional().describe('Job title category (e.g., "medical", "engineering", "sales")'),
    })
  ).describe('List of discovered job titles with variations'),
  searchQuery: z.string().describe('The search query used for discovery'),
  totalVariations: z.number().describe('Total number of title variations found'),
});

export type JobTitleDiscoveryResult = z.infer<typeof jobTitleDiscoverySchema>;

/**
 * Schema for educational institute discovery results
 */
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
  totalFound: z.number().describe('Total number of institutes found'),
});

export type InstituteDiscoveryResult = z.infer<typeof instituteDiscoverySchema>;

/**
 * Schema for company group expansion results
 */
export const companyGroupExpansionSchema = z.object({
  companies: z.array(
    z.object({
      name: z.string().describe('Company name'),
      parentGroup: z.string().describe('Parent group name (e.g., "Tata", "Birla")'),
      industry: z.string().nullable().optional().describe('Company industry'),
      location: z.string().nullable().optional().describe('Company location'),
    })
  ).describe('List of companies that are part of the group'),
  groupName: z.string().describe('The group name that was expanded'),
  totalCompanies: z.number().describe('Total number of companies in the group'),
});

export type CompanyGroupExpansionResult = z.infer<typeof companyGroupExpansionSchema>;

