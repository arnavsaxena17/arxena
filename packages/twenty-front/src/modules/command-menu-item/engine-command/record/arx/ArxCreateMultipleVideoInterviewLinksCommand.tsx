import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useCreateManyVideoInterviewLinks } from '@/object-record/hooks/useCreateManyVideoInterviewLinks';
import { isDefined } from 'twenty-shared/utils';

export const ArxCreateMultipleVideoInterviewLinksCommand = () => {
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const { createVideoInterviewLinks } = useCreateManyVideoInterviewLinks();

  const handleExecute = async () => {
    const recordIds = await resolveRecordIds();
    await createVideoInterviewLinks(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Create Multiple Video Interview Links"
      subtitle="Are you sure you want to create multiple video interview links?"
      confirmButtonText="Create Multiple Video Interview Links"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
