import { writeFileSync } from 'fs';

import {
  ALL_SEARCH_TOOLS_ENABLED,
  filterSearchSkillContent,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config';
import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

it('dumps the marker audit', () => {
  const filtered = filterSearchSkillContent(
    getSkillContent('sourcing'),
    ALL_SEARCH_TOOLS_ENABLED,
  );
  const leftover = filtered.split('\n').filter((line) => line.includes('<!--'));

  writeFileSync(
    '/tmp/marker-audit.md',
    [
      `provider markers left: ${filtered.match(/:(start|end) -->/g)?.length ?? 0}`,
      `section markers left: ${filtered.match(/<!-- skill-section:/g)?.length ?? 0}`,
      `sample leftovers: ${leftover.slice(0, 2).join(' | ')}`,
    ].join('\n'),
  );
});
