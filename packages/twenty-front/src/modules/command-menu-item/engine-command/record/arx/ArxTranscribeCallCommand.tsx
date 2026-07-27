import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useTranscribeCall } from '@/object-record/hooks/useTranscribeCall';

export const ArxTranscribeCallCommand = () => {
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const { transcribeCall } = useTranscribeCall({});

  const handleExecute = async () => {
    const recordIds = await resolveRecordIds();
    await transcribeCall(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Transcribe Call"
      subtitle="Are you sure you want to transcribe this call?"
      confirmButtonText="Transcribe Call"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
