import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useRefreshChatStatus } from '@/object-record/hooks/useRefreshChatStatus';

export const ArxRefreshChatStatusesCommand = () => {
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const { refreshChatStatus } = useRefreshChatStatus();

  const handleExecute = async () => {
    const recordIds = await resolveRecordIds();
    await refreshChatStatus(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Refresh Chat Status"
      subtitle="Are you sure you want to refresh chat statuses for the selected records?"
      confirmButtonText="Refresh Chat Status"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
