import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { apiKeysState } from '@/arx-jd-upload/states/apiKeysState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { isDefined } from 'twenty-shared';
import {
  type CheckDataIntegrityOfJobOptions,
  useCheckDataIntegrityOfJob,
} from './useCheckDataIntegrityOfJob';

type UseStartChatProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useStartChats = ({
  onSuccess,
  onError,
}: UseStartChatProps = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const apiKeys = useRecoilValue(apiKeysState);
  const { enqueueSnackBar } = useSnackBar();
  const tableState = useRecoilValue(tableStateAtom);
  const { checkDataIntegrityOfJob } = useCheckDataIntegrityOfJob({
    onError: (error) => {
      enqueueSnackBar('Data integrity check failed', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
      
      if (isDefined(onError)) {
        onError(error);
      }
    },
  });

  const sendStartChatRequest = async (candidateIds: string[], objectNameSingular: string, jobIds?: string[]) => {
    console.log("CandidateIds::", candidateIds);
    console.log("objectNameSingular::", objectNameSingular);
    console.log("jobIds::", jobIds);
    
    setLoading(true);
    setError(null);

    try {
      if (!apiKeys?.openaikey?.trim()) {
        throw new Error(
          'OpenAI API key is missing. Add it in Settings → API keys before starting chats.',
        );
      }

      console.log("tableState::", tableState.rawData);
      // Validate phone numbers for selected candidates
      // const candidatesWithoutPhones = tableState.rawData
      //   .filter(candidate => candidateIds.includes(candidate.id))
      //   .filter(candidate => !candidate?.phoneNumber?.primaryPhoneNumber);

      // if (candidatesWithoutPhones.length > 0) {
      //   const errorMessage = `Cannot start chat with ${candidatesWithoutPhones.length} candidate(s) without phone numbers. Please add phone numbers first.`;
      //   throw new Error(errorMessage);
      // }

      // Check if candidates have required messaging channels
      const candidatesWithoutValidChannels = tableState.rawData
        .filter(candidate => candidateIds.includes(candidate.id))
        .filter(candidate => {
          const messagingChannel = candidate?.messagingChannel;
          
          // Check if candidate has any valid messaging channel
          if (!messagingChannel) {
            return true; // No messaging channel, so invalid
          }
          
          // For WhatsApp channels, check if phoneNumber exists
          if (['baileys', 'whatsapp-web', 'whatsapp-official','whatsapp-unipile'].includes(messagingChannel)) {
            return !candidate?.phoneNumber?.primaryPhoneNumber;
          }
          
          // For LinkedIn channels, check if linkedinUrl exists
          if (['linkedin', 'linkedin-premium', 'linkedin-inmail'].includes(messagingChannel)) {
            return !candidate?.linkedinUrl;
          }
          
          return true; // Unknown channel type, consider invalid
        });

      // console.log("candidatesWithoutPhones::", candidatesWithoutPhones);
        console.log("candidatesWithoutValidChannels::", candidatesWithoutValidChannels);
      if (candidatesWithoutValidChannels.length > 0) {
        const errorMessage = `Cannot start chat with ${candidatesWithoutValidChannels.length} candidate(s) without valid messaging channels. WhatsApp channels (baileys, whatsapp-web, whatsapp-official) require phone numbers, and LinkedIn channels require LinkedIn URL. Please configure messaging channels first.`;
        throw new Error(errorMessage);
      }

      // Check data integrity if jobIds are provided
      if (isDefined(jobIds) && jobIds.length > 0) {
        const selectedRows = tableState.rawData.filter((candidate) =>
          candidateIds.includes(candidate.id),
        );
        const integrityOptions: CheckDataIntegrityOfJobOptions | undefined =
          selectedRows.length === candidateIds.length && candidateIds.length > 0
            ? {
                messagingChannelsForKeys: selectedRows
                  .map((c) => c?.messagingChannel?.trim())
                  .filter(
                    (ch): ch is string =>
                      typeof ch === 'string' && ch.length > 0,
                  ),
              }
            : undefined;

        const jobDataOk = await checkDataIntegrityOfJob(
          jobIds,
          integrityOptions,
        );
        if (!jobDataOk) {
          throw new Error(
            'Job validation failed. Fix the issues shown above before starting chats.',
          );
        }
      } else {
        throw new Error('No job IDs provided for data integrity check');
      }

      let apiEndpoint = 'start-chats';
      if (objectNameSingular === 'candidate' || objectNameSingular.toLowerCase().includes('jobcandidate')) {
        apiEndpoint = 'start-chats-by-candidate-ids';
      }
      const url = `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/${apiEndpoint}`;

      const results = await axios.post(
        url, { candidateIds: candidateIds, objectNameSingular }, 
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'Content-Type': 'application/json' } }
      );
      
      console.log("results::", results);
      
      if (isDefined(onSuccess)) {
        onSuccess();
      }
      
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : `Failed to start chat link`;
      
      const error = new Error(errorMessage);
      setError(error);

      const isDuplicateJobValidationSnack =
        errorMessage.startsWith('Job validation failed');
      if (!isDuplicateJobValidationSnack) {
        enqueueSnackBar(errorMessage, {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      }

      if (isDefined(onError)) {
        onError(error);
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendStartChatRequest,
    loading,
    error,
  };
};