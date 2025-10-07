import { z } from 'zod';

/**
 * Zod schema for LinkedIn Classic People Search parameters
 */
export const classicPeopleSearchSchema = z.object({
  keywords: z.string().nullable(),
  industry: z.array(z.string()).nullable(),
  location: z.array(z.string()).nullable(),
  profile_language: z.array(z.string()).nullable(),
  network_distance: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).nullable(),
  company: z.array(z.string()).nullable(),
  past_company: z.array(z.string()).nullable(),
  school: z.array(z.string()).nullable(),
  service: z.array(z.string()).nullable(),
  connections_of: z.array(z.string()).nullable(),
  followers_of: z.array(z.string()).nullable(),
  open_to: z.array(z.union([z.literal('proBono'), z.literal('boardMember')])).nullable(),
  advanced_keywords: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    title: z.string().nullable(),
    company: z.string().nullable(),
    school: z.string().nullable(),
  }).nullable(),
});
