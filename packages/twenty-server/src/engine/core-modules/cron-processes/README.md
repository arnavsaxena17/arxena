# Distributed Cron Processing

## Overview

The candidate engagement cron service has been modified to distribute workspace processing across a 2-minute window to avoid database load spikes.

## How It Works

### Before (Problem)
- All workspaces were processed simultaneously every 2 minutes
- This caused database load spikes at :00 and :02 of every hour
- High concurrent database connections and resource contention

### After (Solution)
- Each workspace gets a deterministic 10-second time slot within a 120-second window
- The cron runs every minute but only processes workspaces scheduled for the current time slot
- Workspaces are distributed evenly across the 2-minute window

## Configuration

```typescript
const DISTRIBUTION_WINDOW_SECONDS = 120; // 2 minutes
const TIME_SLOT_SECONDS = 10; // 10 seconds per workspace
const TOTAL_TIME_SLOTS = 12; // 120/10 = 12 slots
```

## Distribution Algorithm

1. **Hash Generation**: Each workspace ID is hashed using MD5
2. **Slot Assignment**: `hash % 12` determines which 10-second slot the workspace gets
3. **Time Calculation**: Current time determines which slot should run now
4. **Processing**: Only workspaces in the current slot are processed

## Example

```
Time: 00:00:05 (slot 0)
- Workspaces with hash % 12 = 0 are processed

Time: 00:00:15 (slot 1)  
- Workspaces with hash % 12 = 1 are processed

Time: 00:00:25 (slot 2)
- Workspaces with hash % 12 = 2 are processed

... and so on
```

## Benefits

1. **Reduced Database Load**: No more simultaneous processing of all workspaces
2. **Predictable Scheduling**: Each workspace runs at the same time every cycle
3. **Scalable**: Easy to adjust time slots or window size
4. **Debuggable**: Clear logging shows which workspaces run when

## Monitoring

The service logs:
- Current time slot being processed
- Which workspaces are scheduled for each slot
- Distribution statistics (in development mode)
- Processing times and success/failure rates

## Testing

Use the static test method to verify distribution:

```typescript
CandidateEngagementCronService.testDistribution(['workspace-id-1', 'workspace-id-2', ...]);
```

## Tuning

To adjust the distribution:

1. **Change time slot size**: Modify `TIME_SLOT_SECONDS`
2. **Change window size**: Modify `DISTRIBUTION_WINDOW_SECONDS` 
3. **Change cron frequency**: Update `TimeManagement.crontabs.crontTabToExecuteCandidateEngagement`

## Migration Notes

- The cron now runs every minute instead of every 2 minutes
- Each workspace will run at the same time slot in every 2-minute cycle
- No data migration required - the change is purely in scheduling logic 