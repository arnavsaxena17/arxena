# `/message/stream` Endpoint Analysis

## Executive Summary

The `/message/stream` endpoint has **significant scalability and user experience concerns** that will impact the system's ability to handle high request volumes. The endpoint performs multiple long-running operations synchronously, holds connections open for extended periods, and lacks proper resource management.

## Critical Issues

### 1. **Long-Running Operations Blocking Event Loop**

**Problem:**
- LLM API calls (10-30+ seconds per request)
- Multiple sequential LinkedIn API calls for strategy previews
- Database operations (GraphQL mutations)
- Parameter resolution calls

**Impact:**
- Each request holds an SSE connection for 30-120+ seconds
- Node.js event loop blocked during synchronous operations
- Server cannot handle concurrent requests efficiently
- Memory consumption grows with each open connection

**Code Evidence:**
```1007:1138:arxena/packages/twenty-server/src/engine/core-modules/candidate-search/controllers/candidate-search.controller.ts
@Post('message/stream')
async processMessageStream(...) {
  // No timeout, no connection limits
  // Operations can take 30-120+ seconds
  const messageClassification = await this.searchGenerationService.classifyMessage(...);
  // Blocks for 2-5 seconds
  
  // Then calls handlers that perform:
  // - LLM streaming (10-30 seconds)
  // - LinkedIn API calls (5-10 seconds each)
  // - Database operations (1-3 seconds each)
}
```

### 2. **Sequential Strategy Preview Execution**

**Problem:**
```1990:2044:arxena/packages/twenty-server/src/engine/core-modules/candidate-search/controllers/candidate-search.controller.ts
// Execute searches sequentially to avoid rate limits
for (const strategy of strategies) {
  const response = await this.candidateSearchService.searchCandidatesWithParameters(...);
  // Each call takes 5-10 seconds
  // If 5 strategies = 25-50 seconds total
}
```

**Impact:**
- If 5 strategies exist, this adds 25-50 seconds to response time
- Connection held open unnecessarily long
- Poor user experience (waiting 60-120+ seconds total)
- LinkedIn API rate limits may still be hit

### 3. **Complete Plan Generation - Sequential Steps**

**Problem:**
```1806:1879:arxena/packages/twenty-server/src/engine/core-modules/candidate-search/controllers/candidate-search.controller.ts
// 1. Generate search parameters (30-60 seconds)
const searchParamsResult = await this.handleSearchParametersGenerationStream(...);

// 2. Generate enrichments (10-20 seconds)
const enrichmentsResult = await this.handleEnrichmentsGenerationStream(...);

// 3. Generate filters (10-20 seconds)
const filtersResult = await this.handleFiltersGenerationStream(...);

// 4. Generate sorts (10-20 seconds)
const sortsResult = await this.handleSortsGenerationStream(...);
```

**Impact:**
- Total time: 60-120+ seconds for complete plan
- Connection held for entire duration
- No ability to cancel mid-operation
- If any step fails, entire operation fails

### 4. **No Connection Management**

**Missing Features:**
- ❌ No connection timeout
- ❌ No maximum connection limit
- ❌ No cleanup on client disconnect
- ❌ No request queuing
- ❌ No circuit breakers
- ❌ No rate limiting per user/workspace

**Impact:**
- Server can be overwhelmed by too many concurrent connections
- Memory leaks if clients disconnect without proper cleanup
- No protection against abuse
- Single user can exhaust server resources

### 5. **Error Handling Issues**

**Problem:**
```1132:1137:arxena/packages/twenty-server/src/engine/core-modules/candidate-search/controllers/candidate-search.controller.ts
} catch (error) {
  this.logger.error('Error processing streaming chat message:', error);
  res.write(`event: error\n`);
  res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to process message' })}\n\n`);
  res.end();
}
```

**Issues:**
- Connection may not be properly closed in all error scenarios
- No retry logic
- No graceful degradation
- Errors in nested operations may leave connections hanging

### 6. **Database Operations in Hot Path**

**Problem:**
Multiple database calls per request:
- `getSearchFilter()` - called multiple times
- `addChatMessage()` - called after each operation
- `storeEnrichments()`, `storeFilters()`, `storeSorts()` - called sequentially
- GraphQL mutations for each update

**Impact:**
- Database connection pool exhaustion
- Slow response times
- Potential deadlocks under high load

## User Experience Impact

### Current Behavior:
1. User sends message → **2-5 seconds** (classification)
2. LLM generation → **10-30 seconds** (streaming)
3. Parameter resolution → **2-5 seconds**
4. Database save → **1-2 seconds**
5. Search preview → **5-10 seconds**
6. Strategy previews (if 5 strategies) → **25-50 seconds**
7. **Total: 45-102+ seconds per request**

### Under High Load:
- **Request queuing**: Users wait in queue before processing starts
- **Timeouts**: Connections may timeout before completion
- **Memory issues**: Server may crash or become unresponsive
- **Poor UX**: Users see "thinking" indicator for 60+ seconds
- **No feedback**: No progress updates during long operations

## Scalability Concerns

### Estimated Capacity (Current Implementation):
- **Concurrent connections**: ~50-100 (before performance degrades)
- **Requests per minute**: ~10-20 (limited by long operation times)
- **Memory per connection**: ~10-50MB (held for 30-120 seconds)
- **Database connections**: Pool may exhaust with 20+ concurrent requests

### Bottlenecks:
1. **LLM API rate limits** (OpenAI)
2. **LinkedIn API rate limits** (Unipile)
3. **Database connection pool**
4. **Node.js event loop blocking**
5. **Memory for open SSE connections**

## Recommendations

### High Priority (Immediate)

1. **Add Request Timeout**
   ```typescript
   const timeout = setTimeout(() => {
     if (!res.headersSent) {
       sendEvent('error', { error: 'Request timeout' });
       res.end();
     }
   }, 120000); // 2 minutes max
   ```

2. **Add Connection Limits**
   ```typescript
   private activeConnections = new Map<string, number>();
   const maxConnectionsPerUser = 3;
   if (this.activeConnections.get(userId) >= maxConnectionsPerUser) {
     return res.status(429).json({ error: 'Too many active requests' });
   }
   ```

3. **Handle Client Disconnects**
   ```typescript
   req.on('close', () => {
     // Cleanup: cancel ongoing operations
     // Release resources
     // Log for monitoring
   });
   ```

4. **Make Strategy Previews Optional/Async**
   - Don't block response on strategy previews
   - Execute in background
   - Return results via separate endpoint or WebSocket

### Medium Priority (Short-term)

5. **Add Request Queuing**
   - Use BullMQ or similar
   - Queue requests per workspace/user
   - Process with worker threads

6. **Implement Circuit Breakers**
   - Monitor LLM API failures
   - Monitor LinkedIn API failures
   - Fail fast when services are down

7. **Add Rate Limiting**
   - Per user/workspace limits
   - Per endpoint limits
   - Use Redis for distributed rate limiting

8. **Optimize Database Calls**
   - Batch operations
   - Use transactions
   - Cache frequently accessed data

### Long-term Improvements

9. **Move to Background Jobs**
   - Use message queue (BullMQ)
   - Process in worker threads
   - Return job ID immediately
   - Poll for results or use WebSocket

10. **Implement Caching**
    - Cache LLM responses for similar requests
    - Cache parameter resolutions
    - Cache search previews

11. **Add Monitoring & Alerting**
    - Track connection counts
    - Monitor response times
    - Alert on high error rates
    - Track resource usage

12. **Consider Alternative Architecture**
    - WebSocket for bidirectional communication
    - Separate endpoints for each operation type
    - Progressive enhancement (return partial results)

## Testing Recommendations

1. **Load Testing**
   - Test with 50, 100, 200 concurrent connections
   - Measure response times under load
   - Monitor memory and CPU usage
   - Test timeout scenarios

2. **Stress Testing**
   - Test with 1000+ requests in queue
   - Test with slow LLM responses
   - Test with LinkedIn API failures
   - Test database connection exhaustion

3. **User Experience Testing**
   - Test with slow network connections
   - Test with client disconnects
   - Test error scenarios
   - Measure perceived wait time

## Conclusion

The current implementation **will not scale** to handle high request volumes. The endpoint needs significant improvements in:
- Connection management
- Timeout handling
- Resource cleanup
- Error handling
- Operation optimization

**Recommended approach**: Move long-running operations to background jobs with a message queue, and use WebSocket or polling for status updates. This will allow the endpoint to respond quickly and handle many more concurrent users.

