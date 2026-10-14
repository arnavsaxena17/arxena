import { z } from 'zod';

export const FIND_ROLE_AT_COMPANIES_MAX_COMPANIES = 25;

export const FindRoleAtCompaniesInputZodSchema = z.object({
  companies: z
    .array(
      z.object({
        id: z
          .string()
          .optional()
          .describe(
            'Row id of this company on the Companies tab (from get_outreach_working_set). When set with projectId, the found people are linked to that row and its "People found" column is updated, including when nobody is found.',
          ),
        name: z
          .string()
          .min(1)
          .describe(
            'Company or brand as shown on the Companies tab, e.g. "Baskin Robbins India"',
          ),
        alternateNames: z
          .array(z.string())
          .optional()
          .describe(
            'Other names the company trades or is registered under: legal name, parent, brand, e.g. ["Graviss Foods"]. Used to match profiles; add them when the brand differs from the employer on LinkedIn.',
          ),
      }),
    )
    .min(1)
    .max(FIND_ROLE_AT_COMPANIES_MAX_COMPANIES)
    .describe('Companies to look up, one entry each'),
  roles: z
    .array(z.string())
    .min(1)
    .default(['CEO', 'Managing Director', 'Founder'])
    .describe(
      'Roles the user asked for, in their words (CEO, MD, managing director, founder, owner, CFO, ...). Each is classified by the job-title taxonomy service, which supplies the matching titles. Pass every role the user named.',
    ),
  country: z
    .string()
    .optional()
    .describe('Country name to narrow the search, e.g. "India". Never a city.'),
  sources: z
    .array(z.enum(['bright_data', 'google']))
    .default(['bright_data', 'google'])
    .describe(
      'bright_data = Bright Data people database, google = Google search of LinkedIn profiles. Both by default; results are merged.',
    ),
  projectId: z
    .string()
    .optional()
    .describe(
      'Outreach project id. When set, verified people are written to its People tab.',
    ),
  maxBudgetUsd: z
    .number()
    .min(0.005)
    .max(0.1)
    .default(0.03)
    .describe('Bright Data spend cap per company in USD'),
});

export type FindRoleAtCompaniesInput = z.infer<
  typeof FindRoleAtCompaniesInputZodSchema
>;
