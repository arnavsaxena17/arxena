import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useMutation } from '@apollo/client/react';
import { APPLY_OUTREACH_SEQUENCER_GRAPH_OPTIONS } from '@/workflow/graphql/mutations/applyOutreachSequencerGraphOptions';

export type ApplyOutreachSequencerGraphOptionsInput = {
  workflowId: string;
  useLlmConnectionNote: boolean;
  humanInTheLoop: boolean;
  whatsappEnabled: boolean;
  meetingFollowUpEnabled: boolean;
  manualTrigger: boolean;
};

export const useApplyOutreachSequencerGraphOptions = () => {
  const apolloCoreClient = useApolloCoreClient();

  const [mutate] = useMutation(APPLY_OUTREACH_SEQUENCER_GRAPH_OPTIONS, {
    client: apolloCoreClient,
  });

  const applyOutreachSequencerGraphOptions = async (
    input: ApplyOutreachSequencerGraphOptionsInput,
  ) => {
    const result = await mutate({
      variables: { input },
      awaitRefetchQueries: true,
      refetchQueries: 'active',
    });

    return (
      result.data as
        | {
            applyOutreachSequencerGraphOptions?: {
              id: string;
              name: string;
              status: string;
            };
          }
        | undefined
    )?.applyOutreachSequencerGraphOptions;
  };

  return { applyOutreachSequencerGraphOptions };
};
