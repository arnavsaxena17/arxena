# Load Testing Guide for `/candidate-search/message/stream` Endpoint

This directory contains multiple load testing tools and scripts for testing the SSE streaming endpoint.

## Prerequisites

1. **Get Authentication Token**
   - Log into the application
   - Extract the Bearer token from browser DevTools (Network tab)
   - Or use the API to authenticate and get a token

2. **Get Job ID or Search Filter ID** (Required - see [WHY_SEARCH_FILTER_ID.md](./WHY_SEARCH_FILTER_ID.md))
   
   **Why it's needed:** The endpoint saves all generated data (search parameters, enrichments, filters, sorts, chat history) to a `SearchFilter` database record. The `searchFilterId` identifies which record to update.
   
   **Option A: Use Job ID (Recommended - Automatic)**
   ```bash
   # The load test scripts will automatically create a SearchFilter for you
   export JOB_ID="your-job-id-here"
   ```
   
   **Option B: Use Existing Search Filter ID**
   ```bash
   # Use an existing SearchFilter
   export SEARCH_FILTER_ID="your-search-filter-id-here"
   ```
   
   **How to get a Job ID:**
   - Create a job in the application
   - Or use an existing job ID from the URL or API

3. **Set Environment Variables**
   ```bash
   export TOKEN="your-bearer-token-here"
   export JOB_ID="your-job-id-here"  # OR export SEARCH_FILTER_ID="your-search-filter-id"
   export BASE_URL="http://localhost:3000"  # or your server URL
   ```

## Testing Tools

### 1. Node.js Script (Recommended for Quick Tests)

**File:** `load-test-sse-endpoint.js`

**Installation:**
```bash
# No additional dependencies needed (uses Node.js built-ins)
```

**Usage:**
```bash
node load-test-sse-endpoint.js \
  --url http://localhost:3000 \
  --token $TOKEN \
  --searchFilterId $SEARCH_FILTER_ID \
  --concurrent 10 \
  --duration 60 \
  --message "generate search parameters"
```

**Features:**
- Real-time statistics every 5 seconds
- Tracks events, bytes, response times
- Handles SSE stream parsing
- Graceful shutdown with Ctrl+C

**Output:**
- Real-time metrics during test
- Final summary with success rates, response times, errors

---

### 2. k6 (Recommended for Production-Like Testing)

**File:** `k6-load-test.js`

**Installation:**
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
# Download from https://k6.io/docs/getting-started/installation/
```

**Usage:**
```bash
# Basic test
k6 run --env TOKEN=$TOKEN --env SEARCH_FILTER_ID=$SEARCH_FILTER_ID k6-load-test.js

# Custom virtual users and duration
k6 run --vus 20 --duration 120s \
  --env TOKEN=$TOKEN \
  --env SEARCH_FILTER_ID=$SEARCH_FILTER_ID \
  --env BASE_URL=http://localhost:3000 \
  k6-load-test.js

# With thresholds
k6 run --thresholds http_req_duration=p\(95\)\<60000 k6-load-test.js
```

**Features:**
- Phased load testing (ramp up/down)
- Custom metrics and thresholds
- HTML report generation
- Cloud integration (k6 Cloud)

**Output:**
- Real-time metrics
- Summary with percentiles
- JSON summary file

---

### 3. Artillery (Good for Complex Scenarios)

**Files:** `artillery-config.yml`, `artillery-processor.js`

**Installation:**
```bash
npm install -g artillery
```

**Usage:**
```bash
# Basic test
BASE_URL=http://localhost:3000 TOKEN=$TOKEN SEARCH_FILTER_ID=$SEARCH_FILTER_ID \
  artillery run artillery-config.yml

# With custom output
artillery run --output report.json artillery-config.yml
artillery report report.json
```

**Features:**
- YAML-based configuration
- Multiple scenarios
- CSV payload support
- Plugin ecosystem

---

### 4. Python Script (Async/Await)

**File:** `load-test-python.py`

**Installation:**
```bash
pip install aiohttp
```

**Usage:**
```bash
python load-test-python.py \
  --url http://localhost:3000 \
  --token $TOKEN \
  --search-filter-id $SEARCH_FILTER_ID \
  --concurrent 10 \
  --duration 60 \
  --message "generate search parameters"
```

**Features:**
- Async/await for true concurrency
- Real-time statistics
- Detailed error tracking
- Response time percentiles

---

## Monitoring During Tests

### Server-Side Monitoring

**Key Metrics to Monitor:**

1. **Node.js Process**
   ```bash
   # Memory usage
   node --inspect your-server.js
   # Then use Chrome DevTools or
   # Use pm2 for monitoring
   pm2 monit
   ```

2. **Database Connections**
   ```sql
   -- PostgreSQL
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
   ```

3. **System Resources**
   ```bash
   # CPU and Memory
   top
   htop
   
   # Network connections
   netstat -an | grep :3000 | wc -l
   ss -tan | grep :3000 | wc -l
   ```

4. **Application Logs**
   ```bash
   # Watch for errors, timeouts, slow queries
   tail -f logs/application.log | grep -i "error\|timeout\|slow"
   ```

### Client-Side Monitoring

Monitor these metrics during tests:

- **Connection Count**: Active SSE connections
- **Response Times**: P50, P95, P99 percentiles
- **Success Rate**: Percentage of successful requests
- **Error Rate**: Types and frequency of errors
- **Throughput**: Requests per second
- **Event Rate**: Events received per second
- **Data Transfer**: Bytes received

---

## Test Scenarios

### 1. Baseline Test
```bash
# Low load to establish baseline
--concurrent 5 --duration 30
```

### 2. Sustained Load Test
```bash
# Moderate sustained load
--concurrent 20 --duration 300
```

### 3. Spike Test
```bash
# Sudden spike in traffic
--concurrent 100 --duration 60
```

### 4. Stress Test
```bash
# Find breaking point
--concurrent 50 --duration 600
```

### 5. Endurance Test
```bash
# Long-running test
--concurrent 10 --duration 3600  # 1 hour
```

---

## Expected Results

### Healthy System Should Show:

- **Success Rate**: > 95%
- **Response Time (P95)**: < 120 seconds (due to LLM calls)
- **Error Rate**: < 5%
- **Connection Stability**: No connection drops
- **Memory**: Stable, no leaks
- **CPU**: < 80% under load

### Warning Signs:

- **Success Rate**: < 90%
- **Response Time (P95)**: > 180 seconds
- **Error Rate**: > 10%
- **Connection Drops**: Frequent timeouts
- **Memory Growth**: Continuous increase
- **CPU**: > 90% sustained

---

## Troubleshooting

### Common Issues:

1. **"Too many connections"**
   - Reduce concurrent requests
   - Check server connection limits
   - Implement connection pooling

2. **"Request timeout"**
   - Increase timeout values
   - Check LLM API response times
   - Optimize slow operations

3. **"Memory errors"**
   - Reduce concurrent requests
   - Check for memory leaks
   - Increase server memory

4. **"Database connection errors"**
   - Check connection pool size
   - Monitor database connections
   - Optimize queries

---

## Interpreting Results

### Key Metrics:

1. **Response Time Distribution**
   - Most requests should complete in 30-60 seconds
   - P95 should be < 120 seconds
   - P99 may be higher due to LLM variability

2. **Success Rate**
   - Should be > 95% under normal load
   - < 90% indicates system stress

3. **Error Types**
   - Timeout errors: System overloaded
   - Connection errors: Resource exhaustion
   - 500 errors: Application errors
   - 429 errors: Rate limiting

4. **Throughput**
   - Measure requests per second
   - Compare against baseline
   - Identify bottlenecks

---

## Best Practices

1. **Start Small**: Begin with low concurrency and gradually increase
2. **Monitor Everything**: Watch server, database, and application metrics
3. **Test Realistic Scenarios**: Use actual message types and data
4. **Run Multiple Times**: Average results over multiple test runs
5. **Test During Off-Peak**: Avoid impacting real users
6. **Document Results**: Keep records for comparison
7. **Set Alerts**: Configure monitoring alerts before testing

---

## Next Steps

After load testing, you should:

1. **Identify Bottlenecks**: Find slow operations
2. **Optimize Code**: Fix performance issues
3. **Add Safeguards**: Implement timeouts, limits, circuit breakers
4. **Scale Infrastructure**: If needed, add more resources
5. **Re-test**: Verify improvements with another load test

---

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Server-Sent Events (SSE) Spec](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

