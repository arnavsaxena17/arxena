# Drip Campaign Module

This module provides comprehensive drip campaign functionality for managing email sequences and tracking email performance.

## Features

- **Campaign Management**: Create, update, delete, and manage drip campaigns
- **Email Sequences**: Create email sequences with customizable delays and content
- **Email Tracking**: Track email opens, clicks, replies, bounces, and unsubscribes
- **Metrics Dashboard**: View campaign performance metrics and analytics
- **Gmail Integration**: Send emails through Gmail with tracking capabilities

## Components

### Core Components

- `DripCampaignModal`: Main modal for managing drip campaigns
- `DripCampaignLeftSideContainer`: Left panel for campaign navigation
- `DripCampaignRightSideContainer`: Right panel for campaign management
- `EmailSequenceManager`: Manages email sequences within a campaign
- `EmailSequenceEditor`: Editor for creating/editing email sequences
- `CampaignMetrics`: Displays campaign performance metrics

### Action Components

- `DripCampaignActionButton`: Button to open drip campaign modal

## Hooks

- `useDripCampaigns`: Manages campaign CRUD operations
- `useEmailSequences`: Manages email sequence operations

## States

- `isDripCampaignModalOpenState`: Controls modal visibility
- `isDripCampaignModalMinimizedState`: Controls modal minimization
- `dripCampaignsState`: Stores campaign data
- `activeDripCampaignState`: Currently selected campaign
- `activeEmailSequenceState`: Currently selected email sequence
- `emailTrackingState`: Email tracking data
- `campaignMetricsState`: Campaign performance metrics

## Usage

### Basic Integration

```tsx
import { DripCampaignModal } from '@/drip-campaign/dripCampaignModal';
import { DripCampaignActionButton } from '@/drip-campaign/components/DripCampaignActionButton';

export const YourComponent = () => {
  const jobId = 'your-job-id';
  const objectNameSingular = 'Job';
  const objectRecordId = 'your-record-id';
  
  const handleRefresh = () => {
    // Refresh your data
  };

  return (
    <>
      <DripCampaignActionButton
        jobId={jobId}
        objectNameSingular={objectNameSingular}
        objectRecordId={objectRecordId}
        onRefresh={handleRefresh}
      />
      
      <DripCampaignModal
        objectNameSingular={objectNameSingular}
        objectRecordId={objectRecordId}
        onRefresh={handleRefresh}
      />
    </>
  );
};
```

### Using Hooks

```tsx
import { useDripCampaigns } from '@/drip-campaign/hooks/useDripCampaigns';
import { useEmailSequences } from '@/drip-campaign/hooks/useEmailSequences';

export const YourComponent = () => {
  const {
    campaigns,
    activeCampaign,
    isLoading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
  } = useDripCampaigns();

  const {
    createSequence,
    updateSequence,
    deleteSequence,
  } = useEmailSequences();

  // Use the hooks to manage campaigns and sequences
};
```

## Backend Integration

The module integrates with the backend drip campaign services:

- **Campaign Management**: CRUD operations for campaigns
- **Email Sequences**: Manage email sequences with delays
- **Email Tracking**: Track email performance metrics
- **Gmail Integration**: Send emails through Gmail API

## Email Tracking

The module includes comprehensive email tracking:

- **Open Tracking**: Tracks when emails are opened
- **Click Tracking**: Tracks when links are clicked
- **Reply Tracking**: Tracks when emails are replied to
- **Bounce Tracking**: Tracks bounced emails
- **Unsubscribe Tracking**: Tracks unsubscribes

## Metrics

The module provides detailed campaign metrics:

- Total sent emails
- Delivery rate
- Open rate
- Click rate
- Reply rate
- Bounce rate
- Unsubscribe rate

## Styling

The module follows Twenty's design system:

- Uses `@emotion/styled` for styling
- Follows the theme object for colors and spacing
- Responsive design with proper breakpoints
- Consistent with other Twenty components

## Dependencies

- React
- Recoil (state management)
- Axios (HTTP requests)
- Twenty UI components
- Emotion (styling)
