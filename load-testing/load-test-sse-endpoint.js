/**
 * Load Testing Script for /candidate-search/message/stream endpoint
 * 
 * Usage:
 *   node load-test-sse-endpoint.js --url http://localhost:3000 --token YOUR_TOKEN --jobId JOB_ID --concurrent 10 --duration 60
 * 
 * Options:
 *   --url: Base URL of the API (default: http://localhost:3000)
 *   --token: Bearer token for authentication (required)
 *   --jobId: Job ID - will automatically create a searchFilter (required if --searchFilterId not provided)
 *   --searchFilterId: Search filter ID to use (required if --jobId not provided)
 *   --concurrent: Number of concurrent requests (default: 5)
 *   --duration: Test duration in seconds (default: 30)
 *   --message: Message to send (default: "generate search parameters")
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  url: 'http://localhost:3000',
  token: null,
  concurrent: 5,
  duration: 30,
  jobId: null,
  searchFilterId: null, // Will be created automatically if not provided
  message: 'generate search parameters',
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
  console.error('Error: --token is required');
  process.exit(1);
}

if (!config.jobId && !config.searchFilterId) {
  console.error('Error: Either --jobId or --searchFilterId is required');
  console.error('  --jobId: Will automatically create a searchFilter for this job');
  console.error('  --searchFilterId: Use an existing searchFilter');
  process.exit(1);
}

// Sample parsedJD structure
const sampleParsedJD = {
  jobTitle: 'Software Engineer',
  company: 'Tech Corp',
  location: 'San Francisco, CA',
  industry: 'Technology',
  requiredSkills: ['JavaScript', 'TypeScript', 'React'],
  preferredSkills: ['Node.js', 'GraphQL'],
  experienceLevel: 'mid_level',
  education: ['Bachelor\'s Degree'],
  keywords: ['software', 'engineer', 'developer'],
  responsibilities: ['Develop web applications', 'Write clean code'],
  qualifications: ['3+ years experience', 'Strong problem-solving skills'],
  benefits: ['Health insurance', 'Remote work'],
  employmentType: 'full_time',
  remoteWork: true,
  salaryRange: null,
};

/**
 * Create a SearchFilter for the given jobId
 */
function createSearchFilter(jobId, token, baseUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/graphql`);
    const client = url.protocol === 'https:' ? https : http;

    const mutation = `
      mutation CreateOneSearchFilter($input: SearchFilterCreateInput!) {
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
        jobId: jobId,
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
        'Authorization': `Bearer ${token}`,
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
            reject(new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`));
            return;
          }

          if (response.data?.createSearchFilter) {
            resolve(response.data.createSearchFilter.id);
          } else {
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

// Statistics tracking
const stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  timeoutRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  errors: [],
  eventsReceived: 0,
  bytesReceived: 0,
  connections: 0,
  activeConnections: 0,
};

// Track active connections
let activeConnections = 0;
let startTime = Date.now();
let testEndTime = startTime + (config.duration * 1000);

/**
 * Make a single SSE request
 */
function makeSSERequest(requestId) {
  return new Promise((resolve) => {
    const url = new URL(`${config.url}/candidate-search/message/stream`);
    const client = url.protocol === 'https:' ? https : http;
    
    const requestBody = JSON.stringify({
      searchFilterId: config.searchFilterId,
      message: config.message,
      parsedJD: sampleParsedJD,
      searchType: 'classic',
      searchCategory: 'people',
      sampleResults: [],
      dataDistribution: {},
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
        'Content-Length': Buffer.byteLength(requestBody),
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      timeout: 120000, // 2 minutes
    };

    const requestStartTime = Date.now();
    let responseTime = null;
    let eventCount = 0;
    let bytesReceived = 0;
    let receivedDone = false;

    const req = client.request(options, (res) => {
      stats.connections++;
      activeConnections++;

      if (res.statusCode !== 200) {
        stats.failedRequests++;
        stats.errors.push({
          requestId,
          error: `HTTP ${res.statusCode}`,
          timestamp: Date.now(),
        });
        activeConnections--;
        resolve();
        return;
      }

      // Check if it's SSE
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('text/event-stream')) {
        console.warn(`[${requestId}] Warning: Response is not SSE format`);
      }

      let buffer = '';

      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
        stats.bytesReceived += chunk.length;
        buffer += chunk.toString();

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            // Track event types if needed
          } else if (line.startsWith('data: ')) {
            eventCount++;
            stats.eventsReceived++;
            const data = line.slice(6).trim();
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.success === false || parsed.error) {
                stats.failedRequests++;
                stats.errors.push({
                  requestId,
                  error: parsed.error || 'Unknown error',
                  timestamp: Date.now(),
                });
              }
              if (parsed.type === 'done' || parsed.success === true) {
                receivedDone = true;
              }
            } catch (e) {
              // Not JSON, that's okay
            }
          }
        }
      });

      res.on('end', () => {
        responseTime = Date.now() - requestStartTime;
        activeConnections--;

        if (receivedDone || eventCount > 0) {
          stats.successfulRequests++;
          stats.totalResponseTime += responseTime;
          stats.minResponseTime = Math.min(stats.minResponseTime, responseTime);
          stats.maxResponseTime = Math.max(stats.maxResponseTime, responseTime);
        } else {
          stats.failedRequests++;
          stats.errors.push({
            requestId,
            error: 'Connection closed without completion',
            timestamp: Date.now(),
          });
        }

        stats.totalRequests++;
        resolve();
      });

      res.on('error', (error) => {
        activeConnections--;
        stats.failedRequests++;
        stats.errors.push({
          requestId,
          error: error.message,
          timestamp: Date.now(),
        });
        stats.totalRequests++;
        resolve();
      });
    });

    req.on('error', (error) => {
      activeConnections--;
      stats.failedRequests++;
      stats.errors.push({
        requestId,
        error: error.message,
        timestamp: Date.now(),
      });
      stats.totalRequests++;
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      activeConnections--;
      stats.timeoutRequests++;
      stats.failedRequests++;
      stats.errors.push({
        requestId,
        error: 'Request timeout',
        timestamp: Date.now(),
      });
      stats.totalRequests++;
      resolve();
    });

    req.setTimeout(120000); // 2 minutes
    req.write(requestBody);
    req.end();
  });
}

/**
 * Run load test
 */
async function runLoadTest() {
  // Create searchFilter if jobId is provided
  if (config.jobId && !config.searchFilterId) {
    console.log('Creating SearchFilter for jobId:', config.jobId);
    try {
      config.searchFilterId = await createSearchFilter(config.jobId, config.token, config.url);
      console.log(`✅ SearchFilter created: ${config.searchFilterId}\n`);
      
      // Save to file for reference
      fs.writeFileSync('test-search-filter-id.txt', config.searchFilterId + '\n', 'utf8');
    } catch (error) {
      console.error('❌ Failed to create SearchFilter:', error.message);
      console.error('Please provide --searchFilterId instead or check your jobId and token');
      process.exit(1);
    }
  }

  console.log('='.repeat(60));
  console.log('Load Testing SSE Endpoint');
  console.log('='.repeat(60));
  console.log(`URL: ${config.url}/candidate-search/message/stream`);
  console.log(`Concurrent Requests: ${config.concurrent}`);
  console.log(`Duration: ${config.duration} seconds`);
  console.log(`Search Filter ID: ${config.searchFilterId}`);
  if (config.jobId) {
    console.log(`Job ID: ${config.jobId}`);
  }
  console.log('='.repeat(60));
  console.log('Starting test...\n');

  let requestId = 0;
  const interval = setInterval(() => {
    // Launch concurrent requests
    for (let i = 0; i < config.concurrent; i++) {
      if (Date.now() < testEndTime) {
        makeSSERequest(++requestId);
      }
    }
  }, 1000); // Launch new batch every second

  // Print stats every 5 seconds
  const statsInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const avgResponseTime = stats.totalResponseTime / Math.max(stats.successfulRequests, 1);
    
    console.log(`[${elapsed.toFixed(1)}s] ` +
      `Total: ${stats.totalRequests} | ` +
      `Success: ${stats.successfulRequests} | ` +
      `Failed: ${stats.failedRequests} | ` +
      `Active: ${activeConnections} | ` +
      `Avg RT: ${avgResponseTime.toFixed(0)}ms | ` +
      `Events: ${stats.eventsReceived} | ` +
      `Bytes: ${(stats.bytesReceived / 1024 / 1024).toFixed(2)}MB`
    );
  }, 5000);

  // Wait for test duration
  setTimeout(() => {
    clearInterval(interval);
    clearInterval(statsInterval);

    // Wait for active connections to complete (with timeout)
    console.log('\nWaiting for active connections to complete...');
    const waitStart = Date.now();
    const waitInterval = setInterval(() => {
      if (activeConnections === 0 || (Date.now() - waitStart) > 30000) {
        clearInterval(waitInterval);
        printFinalStats();
      }
    }, 1000);
  }, config.duration * 1000);
}

/**
 * Print final statistics
 */
function printFinalStats() {
  const totalTime = (Date.now() - startTime) / 1000;
  const avgResponseTime = stats.totalResponseTime / Math.max(stats.successfulRequests, 1);
  const successRate = (stats.successfulRequests / Math.max(stats.totalRequests, 1)) * 100;
  const requestsPerSecond = stats.totalRequests / totalTime;

  console.log('\n' + '='.repeat(60));
  console.log('FINAL STATISTICS');
  console.log('='.repeat(60));
  console.log(`Test Duration: ${totalTime.toFixed(2)} seconds`);
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Successful Requests: ${stats.successfulRequests}`);
  console.log(`Failed Requests: ${stats.failedRequests}`);
  console.log(`Timeout Requests: ${stats.timeoutRequests}`);
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`Requests/Second: ${requestsPerSecond.toFixed(2)}`);
  console.log(`\nResponse Times:`);
  console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`  Min: ${stats.minResponseTime === Infinity ? 'N/A' : stats.minResponseTime + 'ms'}`);
  console.log(`  Max: ${stats.maxResponseTime}ms`);
  console.log(`\nEvents & Data:`);
  console.log(`  Total Events Received: ${stats.eventsReceived}`);
  console.log(`  Total Bytes Received: ${(stats.bytesReceived / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  Average Events per Request: ${(stats.eventsReceived / Math.max(stats.successfulRequests, 1)).toFixed(2)}`);
  
  if (stats.errors.length > 0) {
    console.log(`\nErrors (showing first 10):`);
    stats.errors.slice(0, 10).forEach((error, index) => {
      console.log(`  ${index + 1}. Request ${error.requestId}: ${error.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  }

  console.log('='.repeat(60));
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nTest interrupted. Generating final statistics...');
  printFinalStats();
});

// Start the test
runLoadTest().catch(console.error);

