import axios from 'axios';
import * as fs from 'fs';
import {
  API_TOKEN,
  REQUIREMENTS_FILE,
  SERVER_URL,
} from './test-candidate-search-flow.config';

export function printBanner(): void {
  console.log('='.repeat(80));
  console.log('Candidate Search Flow Test');
  console.log('='.repeat(80));
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`API Token: ${API_TOKEN ? '***' + API_TOKEN.slice(-4) : 'NOT SET'}`);
  console.log(`Requirements File: ${REQUIREMENTS_FILE}`);
  console.log('='.repeat(80));
}

export function validatePrerequisites(): void {
  if (!API_TOKEN) {
    console.error('\n❌ ERROR: API_TOKEN environment variable is required');
    console.error('   Set it with: export API_TOKEN=your_token_here');
    process.exit(1);
  }

  if (!fs.existsSync(REQUIREMENTS_FILE)) {
    console.error(`\n❌ ERROR: Requirements file not found: ${REQUIREMENTS_FILE}`);
    process.exit(1);
  }
}

export async function checkServerConnectivity(): Promise<void> {
  console.log('\n🔍 Testing server connectivity...');
  try {
    const healthCheck = await axios.get(`${SERVER_URL}/health`, {
      timeout: 5000,
      validateStatus: () => true,
    });
    if (healthCheck.status === 200) {
      console.log('✓ Server is reachable');
    } else {
      console.log(
        `⚠ Server responded with status ${healthCheck.status} (this is OK if health endpoint doesn't exist)`,
      );
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`\n❌ ERROR: Cannot connect to server at ${SERVER_URL}`);
        console.error('   Make sure the server is running and accessible');
        process.exit(1);
      }
      if (error.code === 'ENOTFOUND') {
        console.error(`\n❌ ERROR: Server hostname not found: ${SERVER_URL}`);
        console.error('   Check your SERVER_URL environment variable');
        process.exit(1);
      }
      console.log(
        `⚠ Connectivity check failed: ${error.message || 'Unknown error'} (continuing anyway)`,
      );
    } else if (error instanceof Error) {
      console.log(`⚠ Connectivity check failed: ${error.message} (continuing anyway)`);
    } else {
      console.log(`⚠ Connectivity check failed: Unknown error (continuing anyway)`);
    }
  }
}
