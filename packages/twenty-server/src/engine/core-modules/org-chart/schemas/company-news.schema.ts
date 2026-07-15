import { z } from 'zod';

export const companyNewsItemSchema = z.object({
  summary: z.string().describe('Concise news summary (2-4 sentences)'),
  date: z.string().describe('Approximate publication date or "unknown"'),
  url: z.string().describe('Direct link to the source article'),
});

export const companyNewsLlmResultSchema = z.object({
  company_name: z.string(),
  location: z.string(),
  news_items: z.array(companyNewsItemSchema),
  notes: z.string(),
});

export const companyNewsFetchRecordSchema = z.object({
  fetchedAt: z.string().describe('ISO-8601 date-time when this fetch completed'),
  result: companyNewsLlmResultSchema,
});

export const companyNewsStorageSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  location: z.string().optional(),
  updatedAt: z.string().describe('ISO-8601 date-time of the last storage update'),
  fetches: z.array(companyNewsFetchRecordSchema),
});

export type CompanyNewsItem = z.infer<typeof companyNewsItemSchema>;
export type CompanyNewsLlmResult = z.infer<typeof companyNewsLlmResultSchema>;
export type CompanyNewsFetchRecord = z.infer<typeof companyNewsFetchRecordSchema>;
export type CompanyNewsStorage = z.infer<typeof companyNewsStorageSchema>;
