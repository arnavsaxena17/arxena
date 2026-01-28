import { z } from 'zod';

/**
 * Zod schema for query cleanup response
 * All fields required or explicitly nullable for OpenAI structured output API compatibility
 */
export const queryCleanupSchema = z.object({
  cleanedQuery: z.string().describe('The cleaned up realistic search query that focuses on what candidates actually write in their profiles'),
  reasoning: z.string().nullable().describe('Brief explanation of what was simplified or removed (for debugging purposes, not shown to user)'),
});

export type QueryCleanupResponse = z.infer<typeof queryCleanupSchema>;
