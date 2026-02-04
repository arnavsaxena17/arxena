import * as fs from 'fs';
import { REQUIREMENTS_FILE } from './test-candidate-search-flow.config';

export function extractRequirements(): string[] {
  const content = fs.readFileSync(REQUIREMENTS_FILE, 'utf-8');
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const requirements = lines.filter((line) => {
    if (
      /^[A-Z][a-z\s&]+(\s+\(\d+\))?$/.test(line) &&
      !line.includes('for') &&
      !line.includes('Looking')
    ) {
      return false;
    }
    if (line.length < 20) {
      return false;
    }
    return true;
  });

  return requirements.slice(0, 1);
}
