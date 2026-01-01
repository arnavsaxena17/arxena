/**
 * Helper script to create a test SearchFilter for load testing
 * 
 * Usage:
 *   node create-test-search-filter.js --token YOUR_TOKEN --jobId JOB_ID
 * 
 * Returns the searchFilterId that can be used in load tests
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  url: process.env.BASE_URL || 'http://localhost:3000',
  token: process.env.TOKEN || null,
  jobId: null,
};

args.forEach((arg, index) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const value = args[index + 1];
    if (key in config) {
      config[key] = value;
    }
  }
});

// Validate required config
if (!config.token) {
  console.error('Error: --token is required or set TOKEN environment variable');
  process.exit(1);
}

if (!config.jobId) {
  console.error('Error: --jobId is required');
  console.error('You can get a jobId by:');
  console.error('  1. Creating a job in the application');
  console.error('  2. Or using an existing job ID');
  process.exit(1);
}

/**
 * Execute GraphQL mutation to create a SearchFilter
 */
function createSearchFilter() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.url}/graphql`);
    const client = url.protocol === 'https:' ? https : http;

    // GraphQL mutation to create a SearchFilter
    const mutation = `
      mutation CreateSearchFilter($input: SearchFilterCreateInput!) {
        createSearchFilter(data: $input) {
          id
          name
          jobId
          createdAt
        }
      }
    `;

    const variables = {
      input: {
        name: `Load Test SearchFilter - ${new Date().toISOString()}`,
        jobId: config.jobId,
        searchFilterParameter: {},
        chatHistory: [],
        enrichmentConfigs: [],
        columnFilters: [],
        // Note: sortColumns is not available in CreateInput, only in UpdateInput
      }
    };

    const payload = JSON.stringify({
      query: mutation,
      variables: variables,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.errors) {
            console.error('GraphQL Errors:', JSON.stringify(response.errors, null, 2));
            reject(new Error('GraphQL errors occurred'));
            return;
          }

          if (response.data?.createSearchFilter) {
            resolve(response.data.createSearchFilter);
          } else {
            console.error('Unexpected response:', JSON.stringify(response, null, 2));
            reject(new Error('Failed to create searchFilter'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Alternative: Use REST API if GraphQL doesn't work
 */
async function createSearchFilterViaREST() {
  // This would require knowing the REST endpoint structure
  // For now, we'll use GraphQL
  throw new Error('REST API creation not implemented. Use GraphQL.');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Creating test SearchFilter...');
    console.log(`Job ID: ${config.jobId}`);
    console.log(`API URL: ${config.url}\n`);

    const searchFilter = await createSearchFilter();

    console.log('✅ SearchFilter created successfully!');
    console.log('\n' + '='.repeat(60));
    console.log('SEARCH FILTER ID (use this in load tests):');
    console.log('='.repeat(60));
    console.log(searchFilter.id);
    console.log('='.repeat(60));
    console.log('\nTo use in load tests:');
    console.log(`  export SEARCH_FILTER_ID="${searchFilter.id}"`);
    console.log(`  ./quick-test.sh node 10 60`);
    console.log('\nSearchFilter details:');
    console.log(JSON.stringify(searchFilter, null, 2));

    // Write to file for easy access
    const fs = require('fs');
    fs.writeFileSync(
      'test-search-filter-id.txt',
      searchFilter.id + '\n',
      'utf8'
    );
    console.log('\n✅ SearchFilter ID saved to: test-search-filter-id.txt');

  } catch (error) {
    console.error('\n❌ Error creating SearchFilter:');
    console.error(error.message);
    
    if (error.message.includes('GraphQL')) {
      console.error('\nNote: The GraphQL mutation structure may need to be adjusted');
      console.error('based on your actual GraphQL schema.');
      console.error('\nAlternative: Create a SearchFilter manually in the UI and use that ID.');
    }
    
    process.exit(1);
  }
}

main();

