import { ALL_SEARCH_TOOLS_ENABLED, filterSearchSkillContent } from 'src/engine/core-modules/arxena-tools/utils/search-tools-config';
import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';
import { writeFileSync } from 'fs';

it('dumps people section', () => {
  const raw = getSkillContent('sourcing');
  const filtered = filterSearchSkillContent(raw, ALL_SEARCH_TOOLS_ENABLED);
  const start = filtered.indexOf('## People');
  const end = filtered.indexOf('### Job title search');
  writeFileSync('/tmp/people-section.md', filtered.slice(start, end));
  writeFileSync('/tmp/people-raw.md', raw.slice(raw.indexOf('## People'), raw.indexOf('### Job title search')));
});
