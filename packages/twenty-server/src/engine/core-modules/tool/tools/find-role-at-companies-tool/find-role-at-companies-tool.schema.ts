import { z } from 'zod';

export const FIND_ROLE_AT_COMPANIES_MAX_COMPANIES = 50;
// Companies read from the project by the tool itself are not typed by the
// model, so the cap is about run length, not output size
export const FIND_ROLE_AT_COMPANIES_MAX_PROJECT_COMPANIES = 500;

export const FindRoleAtCompaniesInputZodSchema = z.object({
  companies: z
    .array(
      z.object({
        id: z
          .string()
          .optional()
          .describe(
            'Row id of this company on the Companies tab (from get_outreach_tab). When set with projectId, the found people are linked to that row and its "People found" column is updated, including when nobody is found.',
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
    .optional()
    .describe(
      "Companies to look up, one entry each. Leave out and set fromProject to look up the project's own companies without typing them.",
    ),
  fromProject: z
    .boolean()
    .default(false)
    .describe(
      `Take the companies from the project's Companies tab (needs projectId, up to ${FIND_ROLE_AT_COMPANIES_MAX_PROJECT_COMPANIES}) instead of listing them. Use this for "all companies in this project" / "the filtered ones": the tool reads the rows, skips those already Found, and runs them all in one call. Ignored when companies is given.`,
    ),
  onlyViewMatches: z
    .boolean()
    .default(false)
    .describe(
      "With fromProject: only the rows shown by the Companies tab's applied view (its filters and AI columns).",
    ),
  onlyFailed: z
    .boolean()
    .default(false)
    .describe(
      'With fromProject: only the rows whose "People found" is Lookup failed, to run again after a run that could not complete.',
    ),
  rerunFound: z
    .boolean()
    .default(false)
    .describe(
      'With fromProject: also look up rows already marked Found (paid again). Off by default.',
    ),
  roles: z
    .array(z.string())
    .min(1)
    .default(['CEO', 'Managing Director', 'Founder'])
    .describe(
      'Roles the user asked for, in their words (CEO, MD, managing director, founder, owner, CFO, ...). Each is classified by the job-title taxonomy service, which supplies the matching titles. Pass every role the user named.',
    ),
  location: z
    .string()
    .optional()
    .describe(
      'Where the people should be based: city, state/region, or country, e.g. "Mumbai", "Maharashtra", or "India".',
    ),
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
