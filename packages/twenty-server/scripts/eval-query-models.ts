/**
 * Multi-search-type LinkedIn Query Generation — Model Evaluation v2
 *
 * Evaluates OpenAI models × 20 diverse requirements × 3 LinkedIn search types:
 *   • recruiter       — LinkedIn Recruiter (role filter + keywords + location name strings → resolved to geo IDs in production)
 *   • sales_navigator — Sales Navigator (role.include[] + keywords + industry + location text)
 *   • classic         — Classic LinkedIn Search (keywords boolean ≤6 terms + industry enum + company)
 *
 * Run (all — ~780 API calls, ~45–60 min):
 *   yarn workspace twenty-server exec npx tsx -r tsconfig-paths/register scripts/eval-query-models.ts
 *
 * Subset filters (comma-separated env vars):
 *   EVAL_MODELS=gpt-4o,o4-mini
 *   EVAL_REQS=sales_cbo,eng_vp
 *   EVAL_SEARCH_TYPES=recruiter                    ← fastest single-type run
 *   EVAL_SEARCH_TYPES=recruiter,sales_navigator    ← skip classic
 *
 * Implementation lives in `scripts/eval-query-models/` (this file is the entrypoint only).
 */

import * as path from 'path';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
} catch {
  /* optional */
}

import { main } from './eval-query-models/run-evaluation';

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
