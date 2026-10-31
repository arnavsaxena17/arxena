import { config } from 'dotenv';

// Load test env prerequisites. `.env.test` holds the test-scoped variables;
// `.env` (gitignored, local) overlays real values on top when present.
config({ path: '.env.test' });
config();

// A local `.env` may turn the live AI Overview zone on for real runs. In a unit
// test there is no overview to find, so every company search would sit through
// the zone's retries and 16s cooldowns until its 85s deadline, and the suite
// would spend ten minutes timing out. Tests that exercise the overview set this
// themselves; the default here is off.
process.env.FIND_ROLE_AI_OVERVIEW = 'false';
