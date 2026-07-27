import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useCheckDataIntegrityOfProject } from '@/object-record/hooks/useCheckDataIntegrityOfProject';

export const ArxCheckDataIntegrityOfProjectCommand = () => {
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const { checkDataIntegrityOfProject } = useCheckDataIntegrityOfProject({});

  const handleExecute = async () => {
    const recordIds = await resolveRecordIds();
    await checkDataIntegrityOfProject(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Check Data Integrity"
      subtitle="Are you sure you want to check data integrity of multiple records?"
      confirmButtonText="Check Data Integrity"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
