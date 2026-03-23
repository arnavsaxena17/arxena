import { z } from 'zod';

import { salesNavigatorPeopleSearchSchema } from '../../src/engine/core-modules/candidate-search/schemas/linkedin-sales-navigator-people-search.schema';

// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

// ── Recruiter ──
// For LLM generation we override three fields from recruiterPeopleSearchSchema:
//   • location[].id   → replaced by .name (human-readable string e.g. "Mumbai, Maharashtra,
//                        India"). Production code resolves names → geo IDs later.
//   • role[]          → keywords-only variant (no {id, is_selection} branch — LLMs don't
//                        know LinkedIn's internal taxonomy IDs).
//   • company[]       → keywords-only variant (same reason).
const recruiterLocationItemSchema = z.object({
  name:     z.string().describe('Human-readable location name, e.g. "Mumbai, Maharashtra, India" or "India"'),
  priority: z.union([z.literal('CAN_HAVE'), z.literal('MUST_HAVE'), z.literal('DOESNT_HAVE')]).nullable(),
  scope:    z.union([z.literal('CURRENT'), z.literal('OPEN_TO_RELOCATE_ONLY'), z.literal('CURRENT_OR_OPEN_TO_RELOCATE')]).nullable(),
});
const recruiterRoleItemSchema = z.object({
  keywords: z.string().describe('Short concept stem(s), e.g. "plant OR site OR works"'),
  priority: z.union([z.literal('CAN_HAVE'), z.literal('MUST_HAVE'), z.literal('DOESNT_HAVE')]).nullable(),
  scope:    z.union([z.literal('CURRENT_OR_PAST'), z.literal('CURRENT'), z.literal('PAST'), z.literal('PAST_NOT_CURRENT'), z.literal('OPEN_TO_WORK')]).nullable(),
});
const recruiterCompanyItemSchema = z.object({
  keywords: z.string().describe('Company name(s) — keywords-style, e.g. "Bajaj Finance OR Cholamandalam"'),
  priority: z.union([z.literal('CAN_HAVE'), z.literal('MUST_HAVE'), z.literal('DOESNT_HAVE')]).nullable(),
  scope:    z.union([z.literal('CURRENT_OR_PAST'), z.literal('CURRENT'), z.literal('PAST'), z.literal('PAST_NOT_CURRENT')]).nullable(),
});

const recruiterPeopleRequestSchema = z.object({
  api:      z.literal('recruiter'),
  category: z.literal('people'),
  keywords: z.string().nullable().describe('Full-profile scan — domain / education / credential signals'),
  location: z.array(recruiterLocationItemSchema).nullable(),
  role:     z.array(recruiterRoleItemSchema).nullable(),
  company:  z.array(recruiterCompanyItemSchema).nullable(),
});

const multiRecruiterSchema = z.object({
  searchRequests: z.array(recruiterPeopleRequestSchema).min(2).max(5)
    .describe('Recruiter people search bodies, one per distinct candidate archetype or access path'),
});
export type RecruiterSearchRequest = z.infer<typeof recruiterPeopleRequestSchema>;

// ── Sales Navigator ──
const salesNavPeopleRequestSchema = salesNavigatorPeopleSearchSchema.extend({
  api: z.literal('sales_navigator'),
  category: z.literal('people'),
});
const multiSalesNavSchema = z.object({
  searchRequests: z.array(salesNavPeopleRequestSchema).min(2).max(5)
    .describe('Sales Navigator people search bodies, one per distinct candidate archetype or access path'),
});
export type SalesNavSearchRequest = z.infer<typeof salesNavPeopleRequestSchema>;

// ── Classic (simplified industry to avoid 400-value enum in structured output) ──
const classicEvalSchema = z.object({
  keywords: z.string().nullable().describe(
    'Boolean expression of JOB TITLE VARIATIONS — max 6 terms. Example: "CFO" OR "Chief Financial Officer" OR "Finance Director" OR "Group CFO"',
  ),
  // industry: z.array(z.string()).nullable().describe(
  //   'Canonical LinkedIn industry values. Must match EXACTLY e.g. "Banking", "Financial Services", "Pharmaceutical Manufacturing"',
  // ),
  location: z.array(z.string()).nullable().describe('Location text e.g. "Mumbai, Maharashtra, India"'),
  company: z.array(z.string()).nullable().describe('Current company names'),
  // past_company: z.array(z.string()).nullable().describe('Past company names'),
  school: z.array(z.string()).nullable(),
  // advanced_keywords: z.object({
  //   first_name:  z.string().nullable().optional(),
  //   last_name:   z.string().nullable().optional(),
  //   title:       z.string().nullable().optional(),
  //   company:     z.string().nullable().optional(),
  //   school:      z.string().nullable().optional(),
  // }).nullable().optional(),
});
const classicPeopleRequestSchema = classicEvalSchema.extend({
  api: z.literal('classic'),
  category: z.literal('people'),
});
const multiClassicSchema = z.object({
  searchRequests: z.array(classicPeopleRequestSchema).min(2).max(5)
    .describe('Classic LinkedIn search bodies, one per distinct candidate archetype or access path'),
});
export type ClassicSearchRequest = z.infer<typeof classicPeopleRequestSchema>;

// Union for generic handling
export type AnySearchRequest = RecruiterSearchRequest | SalesNavSearchRequest | ClassicSearchRequest;

export {
  classicPeopleRequestSchema,
  multiClassicSchema, multiRecruiterSchema, multiSalesNavSchema, recruiterPeopleRequestSchema, salesNavPeopleRequestSchema
};

