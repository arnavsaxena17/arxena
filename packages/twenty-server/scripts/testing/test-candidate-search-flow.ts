import * as fs from 'fs';
import {
  checkServerConnectivity,
  printBanner,
  validatePrerequisites,
} from './test-candidate-search-flow.cli';
import { RESULTS_FILE } from './test-candidate-search-flow.config';
import { runPipeline } from './test-candidate-search-flow.pipeline';
import { extractRequirements } from './test-candidate-search-flow.requirements';
import { printSummary } from './test-candidate-search-flow.summary';

async function main(): Promise<void> {
  printBanner();
  validatePrerequisites();
  await checkServerConnectivity();

  const requirements = extractRequirements();
  console.log(`\n📋 Found ${requirements.length} requirements to process\n`);
  console.log('🚀 Starting parallel processing...\n');

  const startTime = Date.now();
  const results = await runPipeline(requirements);
  const totalTime = Date.now() - startTime;

  // Persist full JSON results for offline inspection / diffing.
  try {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify({ requirements, results, totalTime }, null, 2));
    console.log(`\n💾 Saved detailed results to: ${RESULTS_FILE}`);
  } catch (error) {
    console.warn('⚠ Failed to write results file:', error);
  }

  printSummary(results, requirements.length, totalTime);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
