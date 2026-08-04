import { z } from 'zod';

export const companyTechnologyDetailedItemSchema = z.object({
  category: z.string(),
  name: z.string(),
  slug: z.string(),
  trendCategory: z.string(),
  firstDetected: z.string().nullable(),
  lastDetected: z.string().nullable(),
  isHistorical: z.boolean(),
  dataTypes: z.array(z.string()),
});

export const companyTechnologyCategorySchema = z.object({
  category: z.string(),
  technologies: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      trendCategory: z.string(),
      description: z.string().nullable(),
      tags: z.array(z.string()),
    }),
  ),
});

export const companyTechnologyResultSchema = z.object({
  domain: z.string(),
  profileUrl: z.string(),
  detailedUrl: z.string(),
  title: z.string().nullable(),
  meta: z.object({
    liveTechnologiesCount: z.number().nullable(),
    lastTechnologyDetected: z.string().nullable(),
    siteAgeLabel: z.string().nullable(),
    topSiteRank: z.number().nullable(),
    aiIndex: z.object({
      score: z.string().nullable(),
      label: z.string().nullable(),
    }),
    technologySpend: z.string().nullable(),
  }),
  categories: z.array(companyTechnologyCategorySchema),
  detailedTechnologies: z.array(companyTechnologyDetailedItemSchema),
  fetchedAt: z.string(),
  errors: z.array(z.string()),
});

export const companyTechnologyFetchRecordSchema = z.object({
  fetchedAt: z.string(),
  result: companyTechnologyResultSchema,
});

export const companyTechnologyStorageSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  domain: z.string(),
  updatedAt: z.string(),
  fetches: z.array(companyTechnologyFetchRecordSchema),
});

export type CompanyTechnologyResult = z.infer<
  typeof companyTechnologyResultSchema
>;
export type CompanyTechnologyFetchRecord = z.infer<
  typeof companyTechnologyFetchRecordSchema
>;
export type CompanyTechnologyStorage = z.infer<
  typeof companyTechnologyStorageSchema
>;
