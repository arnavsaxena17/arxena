# Candidate Engagement Processing Refactor

## Overview

This refactor moves the candidate engagement processing from a cron-based system to an event-driven queue system with sliding window batching. This provides more responsive processing while avoiding duplicate processing of rapid consecutive messages.

## Changes Made

### 1. New Message Queue (`engagedCandidateProcessingQueue`)

- Added `engagedCandidateProcessingQueue` to `MessageQueue` enum in `message-queue.constants.ts`
- This queue processes candidates for engagement when they send messages

### 2. New Sliding Window Processor (`EngagedCandidateProcessor`)

**File:** `engaged-candidate-processor.job.ts`

Key features:
- **Sliding Window Batching**: When a candidate sends multiple messages, the processor waits for a configurable delay (2 minutes by default) after the last message before processing
- **Duplicate Prevention**: Prevents multiple processing of the same candidate within the sliding window
- **Timeout Protection**: 5-minute timeout per candidate processing to prevent hanging
- **Workspace-aware**: Handles candidates from different workspaces appropriately

Configuration:
```typescript
const SLIDING_WINDOW_DELAY_MS = 2 * 60 * 1000; // 2 minutes delay after last message
const MAX_BATCH_SIZE = 50; // Maximum candidates to process in one batch
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout per candidate
```

### 3. Updated Incoming Message Handler

**File:** `incoming-messages.ts`

Changes:
- Added message queue service injection
- Added `queueCandidateForEngagement()` method
- Added queue call in `createAndUpdateIncomingCandidateChatMessage()` 
- Only queues candidates that are eligible for engagement and not self-messages

### 4. Disabled Cron Processing

**File:** `candidate-engagement-cron.service.ts`

- Set `CRON_DISABLED = true` to disable the existing cron-based processing
- Added comment explaining the change

### 5. Module Registration

**File:** `cron-processes.module.ts`

- Added `EngagedCandidateProcessor` to imports and providers
- Ensures the new processor is registered with the NestJS module system

## How the New System Works

### Message Flow

1. **Message Received**: When a candidate sends a WhatsApp message via `incoming-messages.ts`
2. **Message Processed**: The message is saved to the database via `updateCandidateEngagementDataInTable()`
3. **Queue Candidate**: If the candidate is eligible for engagement (`engagementStatus = true`) and it's not a self-message, the candidate is queued for processing
4. **Sliding Window**: The processor creates/updates a sliding window for the candidate with a 2-minute delay
5. **Batched Processing**: After the delay period (no new messages for 2 minutes), the candidate is processed using existing engagement logic

### Key Benefits

1. **Responsive**: Candidates are processed shortly after they finish sending messages (2-minute delay)
2. **Efficient**: No unnecessary polling of all candidates; only processes those who actually sent messages
3. **Prevents Spam**: Multiple rapid messages from the same candidate are batched together
4. **Scalable**: Each candidate is processed independently, allowing for horizontal scaling
5. **Fault Tolerant**: Timeouts and error handling prevent hanging processes

### Sliding Window Logic

```
Candidate sends message 1 → Start 2-minute timer
Candidate sends message 2 → Reset timer to 2 minutes
Candidate sends message 3 → Reset timer to 2 minutes
... (no more messages for 2 minutes) ...
Timer expires → Process candidate engagement
```

## Configuration

You can adjust the sliding window behavior by modifying these constants in `engaged-candidate-processor.job.ts`:

- `SLIDING_WINDOW_DELAY_MS`: How long to wait after the last message before processing
- `MAX_BATCH_SIZE`: Maximum number of candidates to process in one batch (future use)
- `PROCESSING_TIMEOUT_MS`: Timeout for processing each candidate

## Migration Notes

- The old cron-based system is disabled but not removed, allowing for easy rollback if needed
- Existing candidate engagement logic (`CandidateEngagementArx`) is reused, ensuring consistency
- Queue workers need to be running to process the new queue
- Monitor the `engagedCandidateProcessingQueue` for performance and error rates

## Monitoring

The new processor provides methods for monitoring:
- `getWindowStatus()`: Returns current sliding window states for debugging
- `cleanup()`: Properly cleans up timers during shutdown
- Comprehensive logging for tracking processing flow

## Rollback Plan

If needed, you can rollback by:
1. Setting `CRON_DISABLED = false` in `candidate-engagement-cron.service.ts`
2. Removing the queue call from `incoming-messages.ts`
3. Ensuring the old cron has appropriate scheduling

## Future Enhancements

1. **Metrics**: Add metrics collection for processing times, queue lengths, etc.
2. **Batching**: Implement true batching to process multiple candidates together
3. **Priority**: Add priority queuing for urgent candidates
4. **Rate Limiting**: Add rate limiting per workspace or candidate
5. **Dead Letter Queue**: Add handling for failed processing attempts
