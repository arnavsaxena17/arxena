/**
 * k6 Load Test Script for /candidate-search/message/stream endpoint
 * 
 * Install k6: https://k6.io/docs/getting-started/installation/
 * 
 * Usage:
 *   k6 run k6-load-test.js
 * 
 * With custom options:
 *   k6 run --vus 10 --duration 60s k6-load-test.js
 * 
 * Environment variables:
 *   BASE_URL: API base URL (default: http://localhost:3000)
 *   TOKEN: Bearer token for authentication
 *   JOB_ID: Job ID - will automatically create a searchFilter (required if SEARCH_FILTER_ID not provided)
 *   SEARCH_FILTER_ID: Search filter ID to use (required if JOB_ID not provided)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const eventReceived = new Counter('events_received');
const bytesReceived = new Counter('bytes_received');
const successRate = new Rate('success_rate');
const responseTime = new Trend('response_time');

// Configuration
export const options = {
  stages: [
    { duration: '10s', target: 5 },   // Ramp up to 5 users
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '60s', target: 20 },  // Ramp up to 20 users
    { duration: '30s', target: 10 },  // Ramp down to 10 users
    { duration: '10s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<120000'], // 95% of requests should be below 120s
    http_req_failed: ['rate<0.1'],        // Error rate should be less than 10%
    success_rate: ['rate>0.9'],           // Success rate should be above 90%
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';
const SEARCH_FILTER_ID = __ENV.SEARCH_FILTER_ID || '';

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
 * Parse SSE stream
 */
function parseSSEStream(response) {
  let eventsReceived = 0;
  let bytesReceived = 0;
  let receivedDone = false;
  let hasError = false;

  if (!response.body) {
    return { eventsReceived: 0, bytesReceived: 0, success: false };
  }

  bytesReceived = response.body.length;
  const lines = response.body.split('\n');

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      // Event type
    } else if (line.startsWith('data: ')) {
      eventsReceived++;
      const data = line.slice(6).trim();
      
      try {
        const parsed = JSON.parse(data);
        if (parsed.error || parsed.success === false) {
          hasError = true;
        }
        if (parsed.type === 'done' || parsed.success === true) {
          receivedDone = true;
        }
      } catch (e) {
        // Not JSON, continue
      }
    }
  }

  return {
    eventsReceived,
    bytesReceived,
    success: receivedDone && !hasError,
  };
}

// Create SearchFilter if JOB_ID is provided
function createSearchFilter(jobId, token, baseUrl) {
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
  
  const response = http.post(`${baseUrl}/graphql`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.status !== 200) {
    console.error('Failed to create SearchFilter:', response.body);
    return null;
  }
  
  const data = JSON.parse(response.body);
  if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors));
    return null;
  }
  
  return data.data?.createSearchFilter?.id;
}

export function setup() {
  const JOB_ID = __ENV.JOB_ID;
  const SEARCH_FILTER_ID = __ENV.SEARCH_FILTER_ID;
  const TOKEN = __ENV.TOKEN;
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
  
  if (!TOKEN) {
    console.error('TOKEN environment variable is required');
    return { searchFilterId: null };
  }
  
  let searchFilterId = SEARCH_FILTER_ID;
  
  // Create SearchFilter if JOB_ID is provided
  if (JOB_ID && !searchFilterId) {
    console.log(`Creating SearchFilter for jobId: ${JOB_ID}`);
    searchFilterId = createSearchFilter(JOB_ID, TOKEN, BASE_URL);
    if (searchFilterId) {
      console.log(`✅ SearchFilter created: ${searchFilterId}`);
    } else {
      console.error('❌ Failed to create SearchFilter');
      return { searchFilterId: null };
    }
  }
  
  if (!searchFilterId) {
    console.error('Either JOB_ID or SEARCH_FILTER_ID environment variable is required');
    return { searchFilterId: null };
  }
  
  return { searchFilterId };
}

export default function (data) {
  const TOKEN = __ENV.TOKEN;
  const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
  const searchFilterId = data.searchFilterId;
  
  if (!TOKEN || !searchFilterId) {
    return;
  }

  const url = `${BASE_URL}/candidate-search/message/stream`;
  const payload = JSON.stringify({
    searchFilterId: searchFilterId,
    message: 'generate search parameters',
    parsedJD: sampleParsedJD,
    searchType: 'classic',
    searchCategory: 'people',
    sampleResults: [],
    dataDistribution: {},
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    timeout: '120s', // 2 minutes
  };

  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const responseTimeMs = Date.now() - startTime;

  // Parse SSE response
  const sseData = parseSSEStream(response);

  // Record metrics
  eventReceived.add(sseData.eventsReceived);
  bytesReceived.add(sseData.bytesReceived);
  responseTime.add(responseTimeMs);
  successRate.add(sseData.success);

  // Check response
  const checks = {
    'status is 200': check(response, {
      'status equals 200': (r) => r.status === 200,
    }),
    'content type is SSE': check(response, {
      'content type is text/event-stream': (r) => 
        r.headers['Content-Type'] && r.headers['Content-Type'].includes('text/event-stream'),
    }),
    'received events': check(sseData, {
      'events received > 0': (d) => d.eventsReceived > 0,
    }),
    'request completed': check(sseData, {
      'request completed successfully': (d) => d.success,
    }),
  };

  if (!checks['status is 200'] || !checks['request completed']) {
    console.error(`Request failed: ${response.status} - ${response.body.substring(0, 200)}`);
  }

  sleep(1); // Wait 1 second between requests
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  // Simple text summary
  return `
Test Summary:
=============
Duration: ${data.metrics.iteration_duration.values.avg.toFixed(2)}ms
Total Requests: ${data.metrics.http_reqs.values.count}
Success Rate: ${(data.metrics.success_rate.values.rate * 100).toFixed(2)}%
Avg Response Time: ${(data.metrics.response_time.values.avg / 1000).toFixed(2)}s
P95 Response Time: ${(data.metrics.response_time.values['p(95)'] / 1000).toFixed(2)}s
Events Received: ${data.metrics.events_received.values.count}
Bytes Received: ${(data.metrics.bytes_received.values.count / 1024 / 1024).toFixed(2)}MB
`;
}

