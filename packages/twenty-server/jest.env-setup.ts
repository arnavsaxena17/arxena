import { config } from 'dotenv';

// Load test env prerequisites. `.env.test` holds the test-scoped variables;
// `.env` (gitignored, local) overlays real values on top when present.
config({ path: '.env.test' });
config();
