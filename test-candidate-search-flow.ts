import {
  checkServerConnectivity,
  printBanner,
  validatePrerequisites,
} from './test-candidate-search-flow.cli';
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

  printSummary(results, requirements.length, totalTime);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
