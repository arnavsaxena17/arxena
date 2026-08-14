import { z } from 'zod';

export const PeopleNaturalLanguageParseSchema = z
  .object({
    jobTitle: z
      .string()
      .describe(
        'The role or job title to search for, without company or location. Empty string if none.',
      ),
    companyName: z
      .string()
      .nullable()
      .describe('Company name mentioned in the utterance, or null.'),
    website: z
      .string()
      .nullable()
      .describe(
        'Company website or domain if mentioned (e.g. stayvista.com), or null.',
      ),
    location: z
      .string()
      .nullable()
      .describe(
        'Geographic location for the people search (city, region, or country), or null. Do not treat a department after "in" as location.',
      ),
  })
  .strict();

export type PeopleNaturalLanguageParse = z.infer<
  typeof PeopleNaturalLanguageParseSchema
>;
