import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useRefreshChatCounts } from '@/object-record/hooks/useRefreshChatCounts';

export const ArxRefreshChatCountsCommand = () => {
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const { refreshChatCounts } = useRefreshChatCounts();

  const handleExecute = async () => {
    const recordIds = await resolveRecordIds();
    await refreshChatCounts(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Refresh Chat Counts"
      subtitle="Are you sure you want to refresh chat counts?"
      confirmButtonText="Refresh Chat Counts"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
