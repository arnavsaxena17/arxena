# Why `searchFilterId` is Required

## Purpose of `searchFilterId`

The `searchFilterId` is a **required parameter** because the endpoint uses it for several critical operations:

### 1. **Database Persistence**
The endpoint saves all generated data to a `SearchFilter` database record:
- **Search Parameters** → `searchFilterParameter.generatedSearchParameters`
- **Enrichments** → `enrichmentConfigs`
- **Filters** → `columnFilters`
- **Sorts** → `sortColumns`, `sortStrategyName`, etc.
- **Chat History** → `chatHistory`

```typescript
// From candidate-search.controller.ts:2248
await this.staticGraphQLService.executeGraphQL(
  updateMutation,
  { 
    idToUpdate: searchFilter.id,  // Uses searchFilterId
    input: { 
      searchFilterParameter: updatedSearchFilterParameter,
      chatHistory: searchFilter.chatHistory,
    },
  },
  apiToken
);
```

### 2. **Job Association**
The endpoint retrieves the `jobId` from the searchFilter to provide context to the LLM:

```typescript
// From candidate-search.controller.ts:2179-2182
const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
const jobId = searchFilter?.jobId;  // Used for LLM context
```

### 3. **Chat History Management**
Messages are appended to the searchFilter's chat history:

```typescript
// From candidate-search.controller.ts:2561-2590
private async addChatMessage(
  searchFilterId: string,  // Required to update chat history
  role: 'user' | 'assistant',
  content: string,
  apiToken: string
) {
  const searchFilter = await this.getSearchFilter(searchFilterId, apiToken);
  const currentHistory = searchFilter.chatHistory || [];
  // ... append new message and save
}
```

### 4. **Data Retrieval**
The endpoint fetches existing data from the searchFilter to:
- Check for existing enrichments/filters/sorts
- Merge with new data
- Provide context for generation

## What is a SearchFilter?

A `SearchFilter` is a database record that represents:
- A **search configuration** for a specific job
- **Chat history** for the AI assistant conversation
- **Generated components** (parameters, enrichments, filters, sorts)
- **Association** with a job (`jobId`) and recruiter (`recruiterId`)

## For Load Testing

### Option 1: Use Existing SearchFilter (Current Approach)
**Pros:**
- Simple, no code changes needed
- Tests real database operations
- Realistic scenario

**Cons:**
- Requires manual setup (create searchFilter in UI)
- All test data goes to one searchFilter
- May pollute production data

**How to get one:**
1. Log into the application
2. Create a job and upload a JD
3. Open the AI chat assistant
4. Extract the `searchFilterId` from:
   - Browser DevTools → Network tab → Look for requests to `/candidate-search/message/stream`
   - Or from the URL/state if visible

### Option 2: Create SearchFilter Programmatically (Recommended for Load Testing)

We can add a helper script that creates a test searchFilter before running load tests.

**Benefits:**
- Automated setup
- Clean test data
- Can create multiple searchFilters for parallel testing
- Isolated from production data

**Implementation:**
Create a script that:
1. Authenticates with the API
2. Creates a test job (or uses existing)
3. Creates a searchFilter for that job
4. Returns the searchFilterId
5. Use that ID in load tests

### Option 3: Make Endpoint Handle Missing SearchFilter (Requires Code Changes)

Modify the endpoint to:
- Accept optional `searchFilterId`
- Create a new searchFilter if not provided
- Return the created searchFilterId

**Pros:**
- No manual setup needed
- More flexible

**Cons:**
- Requires code changes
- May not reflect real usage patterns
- Adds complexity to endpoint

## Recommended Approach for Load Testing

**Best Practice:** Use **Option 2** - Create searchFilters programmatically

This gives you:
1. **Isolated test data** - Each test run can use fresh data
2. **Parallel testing** - Multiple searchFilters for concurrent requests
3. **Automation** - No manual steps
4. **Realistic testing** - Still tests real database operations

## Quick Solution

For now, you can:

1. **Get a searchFilterId manually:**
   ```bash
   # In browser DevTools console on the candidate search page:
   # Or check the network requests to find searchFilterId
   ```

2. **Use it in tests:**
   ```bash
   export SEARCH_FILTER_ID="your-id-here"
   ./quick-test.sh node 10 60
   ```

3. **For multiple concurrent tests**, you can:
   - Use the same searchFilterId (all requests update same record)
   - Or create multiple searchFilters and rotate them

## Future Improvement

I can create a helper script that:
- Creates a test searchFilter automatically
- Returns the ID for use in load tests
- Optionally cleans up after tests

Would you like me to create this helper script?

