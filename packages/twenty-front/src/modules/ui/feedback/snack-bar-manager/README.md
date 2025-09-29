# Upload Progress Snackbar Implementation

This implementation adds progress bar functionality to the snackbar system, specifically for tracking upload progress similar to the enrichment progress system.

## Overview

The upload progress system consists of:

1. **Backend Services**: Redis pub-sub based progress tracking
2. **Frontend Hooks**: React hooks for listening to progress updates
3. **Snackbar Integration**: Enhanced snackbar component with progress bars
4. **Automatic Progress Display**: Automatic snackbar management for upload progress

## Backend Components

### 1. UploadProgressPubSubService
- **Location**: `packages/twenty-server/src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service.ts`
- **Purpose**: Manages Redis pub-sub communication for upload progress
- **Key Methods**:
  - `publishUploadStarted()`: Notify when upload starts
  - `publishUploadProcessing()`: Update progress during processing
  - `publishUploadCompleted()`: Notify when upload completes
  - `publishUploadError()`: Notify when upload fails

### 2. UploadProgressController
- **Location**: `packages/twenty-server/src/engine/core-modules/candidate-sourcing/controllers/upload-progress.controller.ts`
- **Purpose**: Provides SSE endpoint for frontend to listen to progress updates
- **Endpoints**:
  - `GET /upload-progress/stream`: SSE stream for progress updates
  - `POST /upload-progress/test-publish`: Test endpoint
  - `GET /upload-progress/test-connection`: Connection test

### 3. Enhanced Upload Endpoint
- **Location**: `packages/twenty-server/src/engine/core-modules/candidate-sourcing/controllers/candidate-sourcing.controller.ts`
- **Changes**: The `upload-profiles` endpoint now publishes progress events

### 4. Enhanced Queue Processor
- **Location**: `packages/twenty-server/src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job.ts`
- **Changes**: The `CandidateQueueProcessor` now publishes progress updates during batch processing

## Frontend Components

### 1. useUploadProgress Hook
- **Location**: `packages/twenty-front/src/modules/websocket-context/useUploadProgress.ts`
- **Purpose**: Connects to SSE stream and provides upload progress data
- **Returns**:
  - `uploadProgress`: Current progress data
  - `isConnected`: Connection status
  - `error`: Any connection errors
  - `reconnect()`: Manual reconnection function

### 2. Enhanced SnackBar Component
- **Location**: `packages/twenty-front/src/modules/ui/feedback/snack-bar-manager/components/SnackBar.tsx`
- **New Props**:
  - `showProgressBar?: boolean`: Show/hide progress bar
  - `progressMessage?: string`: Additional progress message
- **Features**:
  - Conditional progress bar display
  - Progress message support
  - Enhanced progress animation handling

### 3. useUploadProgressSnackBar Hook
- **Location**: `packages/twenty-front/src/modules/ui/feedback/snack-bar-manager/hooks/useUploadProgressSnackBar.ts`
- **Purpose**: Automatically manages snackbars based on upload progress
- **Features**:
  - Automatic snackbar creation for different progress states
  - Progress bar updates
  - Error handling
  - Connection status management

### 4. UploadProgressDemo Component
- **Location**: `packages/twenty-front/src/modules/ui/feedback/snack-bar-manager/components/UploadProgressDemo.tsx`
- **Purpose**: Simple component to enable upload progress tracking
- **Usage**: Include this component in your app to enable automatic upload progress tracking

## Usage

### 1. Enable Upload Progress Tracking

Add the `UploadProgressDemo` component to your app:

```tsx
import { UploadProgressDemo } from '@/modules/ui/feedback/snack-bar-manager/components/UploadProgressDemo';

function App() {
  return (
    <div>
      {/* Your app content */}
      <UploadProgressDemo />
    </div>
  );
}
```

### 2. Manual Progress Tracking

If you need more control, use the hooks directly:

```tsx
import { useUploadProgressSnackBar } from '@/modules/ui/feedback/snack-bar-manager/hooks/useUploadProgressSnackBar';

function MyComponent() {
  const { uploadProgress, isConnected, error } = useUploadProgressSnackBar();
  
  // Progress data is automatically handled by the hook
  // You can also access the raw progress data if needed
  console.log('Current progress:', uploadProgress);
  
  return <div>Upload progress is being tracked automatically</div>;
}
```

### 3. Custom Progress Snackbars

You can also create custom progress snackbars:

```tsx
import { useSnackBar } from '@/modules/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/modules/ui/feedback/snack-bar-manager/components/SnackBar';

function MyComponent() {
  const { enqueueSnackBar } = useSnackBar();
  
  const showCustomProgress = () => {
    enqueueSnackBar('Custom Upload', {
      variant: SnackBarVariant.Info,
      showProgressBar: true,
      progress: 50,
      progressMessage: 'Processing 25/50 files',
      duration: 0, // Don't auto-close
    });
  };
  
  return <button onClick={showCustomProgress}>Show Custom Progress</button>;
}
```

## Progress Data Structure

The upload progress data follows this structure:

```typescript
interface UploadProgressData {
  step: string;                    // 'started' | 'processing' | 'completed' | 'error'
  message: string;                 // Human-readable message
  progress_percentage?: number;    // Progress percentage (0-100)
  total_candidates?: number;       // Total number of candidates
  processed_candidates?: number;   // Number of candidates processed
  current_batch?: number;          // Current batch number
  total_batches?: number;          // Total number of batches
  timestamp: string;               // ISO timestamp
}
```

## Progress States

1. **Started**: Upload process begins
   - Shows: "Upload Started" with 0% progress
   - Duration: Indefinite (until next state)

2. **Processing**: Active processing
   - Shows: "Uploading Candidates" with current progress
   - Updates: Progress percentage and batch information
   - Duration: Indefinite (until completion)

3. **Completed**: Upload finished successfully
   - Shows: "Upload Completed" with 100% progress
   - Duration: 5 seconds (auto-closes)

4. **Error**: Upload failed
   - Shows: "Upload Failed" with error message
   - Duration: 10 seconds (auto-closes)

## Configuration

### Backend Configuration

The services are automatically registered in the `CandidateSourcingModule`. No additional configuration is required.

### Frontend Configuration

Make sure your app has the `SnackBarProvider` in the component tree:

```tsx
import { SnackBarProvider } from '@/modules/ui/feedback/snack-bar-manager/components/SnackBarProvider';

function App() {
  return (
    <SnackBarProvider>
      {/* Your app content */}
      <UploadProgressDemo />
    </SnackBarProvider>
  );
}
```

## Testing

### Backend Testing

Test the upload progress endpoints:

```bash
# Test connection
curl "http://localhost:3000/upload-progress/test-connection?token=YOUR_TOKEN"

# Test publish (requires authentication)
curl -X POST "http://localhost:3000/upload-progress/test-publish?token=YOUR_TOKEN"
```

### Frontend Testing

1. Start an upload process
2. Check browser console for progress messages
3. Verify snackbars appear with progress bars
4. Test error scenarios

## Troubleshooting

### Common Issues

1. **No Progress Updates**: Check if `UploadProgressDemo` is included in your app
2. **Connection Errors**: Verify the SSE endpoint is accessible
3. **Missing Progress Bars**: Ensure `showProgressBar: true` is set
4. **Backend Errors**: Check Redis connection and pub-sub setup

### Debug Mode

Enable debug logging by checking browser console for messages prefixed with:
- `🔗` - Connection events
- `📨` - Message events
- `✅` - Success events
- `❌` - Error events
- `🧹` - Cleanup events

## Future Enhancements

1. **Real-time Progress**: More granular progress updates
2. **Progress Persistence**: Save progress state across page refreshes
3. **Multiple Uploads**: Support for concurrent upload tracking
4. **Custom Progress UI**: More flexible progress bar customization
5. **Progress History**: Track and display upload history
