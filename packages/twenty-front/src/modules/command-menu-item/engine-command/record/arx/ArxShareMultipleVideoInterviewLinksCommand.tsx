import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useShareManyVideoInterviewLinks } from '@/object-record/hooks/useShareManyVideoInterviewLinks';
import { isDefined } from 'twenty-shared/utils';

export const ArxShareMultipleVideoInterviewLinksCommand = () => {
  const { objectMetadataItem } = useHeadlessCommandContextApi();
  const { resolveRecords } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields:
      objectMetadataItem?.nameSingular === 'videoInterview'
        ? { id: true, candidateId: true }
        : { id: true },
  });
  const { shareVideoInterviewLinks } = useShareManyVideoInterviewLinks();

  const handleExecute = async () => {
    if (!isDefined(objectMetadataItem)) {
      throw new Error('Object metadata is required');
    }

    const records = await resolveRecords();
    const recordIds =
      objectMetadataItem.nameSingular === 'videoInterview'
        ? records
            .map((record) => record.candidateId as string | undefined)
            .filter(isDefined)
        : records.map((record) => record.id);

    await shareVideoInterviewLinks(recordIds);
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Share Multiple Video Interview Links"
      subtitle="Are you sure you want to share multiple video interview links?"
      confirmButtonText="Share Multiple Video Interview Links"
      confirmButtonAccent="blue"
      execute={handleExecute}
    />
  );
};
