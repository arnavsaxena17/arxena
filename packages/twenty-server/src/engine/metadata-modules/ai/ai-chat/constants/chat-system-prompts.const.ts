import { readFileSync } from 'fs';
import { join } from 'path';

import { buildRoutingLines } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-routing-lines.util';

// Ask AI loads workflow-building beside outreach, and can paint the org chart.
const SHARED_ROUTING_LINES = buildRoutingLines({
  extraSkillNames: { outreach: ['workflow-building'] },
  routingLineSuffixes: {
    'org-structure-insights':
      ' Then call `highlight_org_chart` when a chart is open.',
    outreach: ' Finish with `list_workflow_runs`.',
  },
});

console.log('SHARED_ROUTING_LINES::', SHARED_ROUTING_LINES);
// console.log("SHARED_ROUTING_LINES::", SHARED_ROUTING_LINES);
// Neutral CRM copy (Ask AI + MCP): Outreach (not GTM Command); Your company
// (not Seller); Target titles (JSON key targetTitles); people / enrolled
// people; create_candidate = Person + enrollment record. Keep LinkedIn Sales
// Navigator / Recruiter as product names.
// Chat-only UI and MCP transport limits live in CHAT_UI / MCP_TRANSPORT.
// Prose lives in ./contents/*.md; the build copies that folder next to this
// file, so the same path works from src in tests and from dist at runtime.
const CONTENTS_DIRECTORY = join(__dirname, 'contents');

const loadPromptSection = (fileName: string): string =>
  readFileSync(join(CONTENTS_DIRECTORY, fileName), 'utf-8').trimEnd();

const SHARED_ROUTING_LINES_PLACEHOLDER = '{{SHARED_ROUTING_LINES}}';

export const CHAT_SYSTEM_PROMPTS = {
  CORE: loadPromptSection('core.md').replace(
    SHARED_ROUTING_LINES_PLACEHOLDER,
    SHARED_ROUTING_LINES,
  ),
  CHAT_UI: loadPromptSection('chat-ui.md'),
  MCP_TRANSPORT: loadPromptSection('mcp-transport.md'),
  RESPONSE_FORMAT: loadPromptSection('response-format.md'),
};
