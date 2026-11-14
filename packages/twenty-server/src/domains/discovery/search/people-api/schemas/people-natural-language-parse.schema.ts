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
    locations: z
      .array(z.string())
      .describe(
        'Geographic locations for the people search (city, region, or country). Empty if none. Split "UAE and Saudi Arabia" into two entries. Do not treat a department after "in" as a location.',
      ),
  })
  .strict();

export type PeopleNaturalLanguageParse = z.infer<
  typeof PeopleNaturalLanguageParseSchema
>;
