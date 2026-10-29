import { z } from 'zod';

export const FIND_PEOPLE_BY_COMPANY_MAX_COMPANIES = 50;
// Companies read from the project by the tool itself are not typed by the
// model, so the cap is about run length, not output size
export const FIND_PEOPLE_BY_COMPANY_MAX_PROJECT_COMPANIES = 500;

export const FindPeopleByCompanyInputZodSchema = z.object({
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
        domain: z
          .string()
          .optional()
          .describe(
            'The company\'s website host, e.g. "tatapower.com". Adds a search of its leadership page.',
          ),
        employees: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            'Employee count, when known. A small company may have no holder of a functional role, so the owner or MD is tried when the plan allows rung 4.',
          ),
      }),
    )
    .min(1)
    .max(FIND_PEOPLE_BY_COMPANY_MAX_COMPANIES)
    .optional()
    .describe(
      "Companies to look up, one entry each. Leave out and set fromProject to look up the project's own companies without typing them.",
    ),
  fromProject: z
    .boolean()
    .default(false)
    .describe(
      `Take the companies from the project's Companies tab (needs projectId, up to ${FIND_PEOPLE_BY_COMPANY_MAX_PROJECT_COMPANIES}) instead of listing them. Use this for "all companies in this project" / "the filtered ones": the tool reads the rows, skips those already Found, and runs them all in one call. Ignored when companies is given.`,
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
    .max(1)
    .optional()
    .describe(
      "Spend cap for one company x role pair in USD, across every source. Defaults to the brief's capsUsd.perPair, else 0.10. A company that reaches it ends as none_found with reason budget.",
    ),
  maxRung: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .optional()
    .describe(
      "Highest title rung a person may be kept at: 1 the title as typed, 2 equivalent titles, 3 a related role or one level down, 4 the owner or MD of a small company. Defaults to the brief's ladder, else 3. Pass it only with a reason the user gave.",
    ),
  minConfidence: z
    .enum(['high', 'medium', 'low'])
    .optional()
    .describe(
      "Stop looking once a person reaches this confidence. Defaults to the brief's threshold, else medium.",
    ),
  pilotSize: z
    .number()
    .int()
    .min(1)
    .max(FIND_PEOPLE_BY_COMPANY_MAX_COMPANIES)
    .optional()
    .describe(
      'Look up only this many companies now and return, so the user can check the role reading and the rung before the rest run. Use 10 on the first lookup of a project.',
    ),
  waitSeconds: z
    .number()
    .int()
    .min(0)
    .max(300)
    .default(150)
    .describe(
      'More companies than one batch start a background run; the call waits this long for it, then returns its runId and progress.',
    ),
  runId: z
    .string()
    .optional()
    .describe(
      'A background run from an earlier call: returns its progress (waiting up to waitSeconds) instead of starting a lookup. Ignores the other inputs.',
    ),
  cancel: z
    .boolean()
    .default(false)
    .describe(
      'With runId: stop the run. Companies already looked up keep their results.',
    ),
});

export type FindPeopleByCompanyInput = z.infer<
  typeof FindPeopleByCompanyInputZodSchema
>;
