import React from 'react';
import { DripCampaignActionButton } from '../components/DripCampaignActionButton';
import { DripCampaignModal } from '../dripCampaignModal';

interface DripCampaignIntegrationExampleProps {
  jobId: string;
  objectNameSingular: string;
  objectRecordId: string;
  onRefresh?: () => void;
}

export const DripCampaignIntegrationExample: React.FC<DripCampaignIntegrationExampleProps> = ({
  jobId,
  objectNameSingular,
  objectRecordId,
  onRefresh
}) => {
  return (
    <>
      {/* Add this button to your job page or wherever you want to trigger drip campaigns */}
      <DripCampaignActionButton
        jobId={jobId}
        objectNameSingular={objectNameSingular}
        objectRecordId={objectRecordId}
        onRefresh={onRefresh}
      />
      
      {/* Add this modal to your main app component or job page */}
      <DripCampaignModal
        objectNameSingular={objectNameSingular}
        objectRecordId={objectRecordId}
        onRefresh={onRefresh}
      />
    </>
  );
};

// Example usage in a job page:
/*
import { DripCampaignIntegrationExample } from '@/drip-campaign/examples/DripCampaignIntegrationExample';

export const JobPage = () => {
  const jobId = 'your-job-id';
  const objectNameSingular = 'Job';
  const objectRecordId = 'your-record-id';
  
  const handleRefresh = () => {
    // Refresh your data here
    console.log('Refreshing data...');
  };

  return (
    <div>
      <h1>Job Page</h1>
      
      {/* Your existing job content */}
      
      {/* Add drip campaign functionality */}
      <DripCampaignIntegrationExample
        jobId={jobId}
        objectNameSingular={objectNameSingular}
        objectRecordId={objectRecordId}
        onRefresh={handleRefresh}
      />
    </div>
  );
};
*/
