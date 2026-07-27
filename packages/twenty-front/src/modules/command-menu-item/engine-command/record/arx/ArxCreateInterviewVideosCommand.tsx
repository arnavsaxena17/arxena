import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useCreateInterviewVideos } from '@/object-record/hooks/useCreateInterviewVideos';

export const ArxCreateInterviewVideosCommand = () => {
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const { createVideosForJobs } = useCreateInterviewVideos({});

  const handleExecute = async () => {
    const recordIds = await resolveRecordIds();
    await createVideosForJobs(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Create Interviewer Avatar Videos"
      subtitle="Are you sure you want to create interview videos for the selected records?"
      confirmButtonText="Create Videos"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
