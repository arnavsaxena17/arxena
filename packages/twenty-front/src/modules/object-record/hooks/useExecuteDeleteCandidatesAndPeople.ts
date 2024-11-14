import { useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

type useExecuteDeleteCandidatesAndPeople = {
  objectNameSingular?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};



export const useExecuteDeleteCandidatesAndPeople = ({
  objectNameSingular,
  onSuccess,
  onError,
}: useExecuteDeleteCandidatesAndPeople = {}) => {


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
//   const showNotification = useShowNotification();
const { enqueueSnackBar } = useSnackBar();
console.log("objectNameSingular:", objectNameSingular)
const deleteCandidatesAndPeople = async (Ids: string[]) => {
  setLoading(true);
  setError(null);

  try {
    const results = await Promise.all(
      Ids.map(async (id) => {
        // Fetch people associated with the candidate
        const url = objectNameSingular === 'candidate'
          ? `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/delete-people-and-candidates-from-candidate-id`
          : `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/delete-people-and-candidates-from-person-id`;

        const body = objectNameSingular === 'candidate'
          ? { candidateId: id }
          : { personId: id };

        const deletionResponse = await axios.post(url, body, {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'Content-Type': 'application/json',
          },
        });

        return deletionResponse;
      })
    );
    console.log("results:", results)

    const successfulDeletions = results.filter(
      (result) => result.status === 200 || result.status === 204 || result.status === 201
    );
    console.log("successfulDeletions:", successfulDeletions)
    if (successfulDeletions.length === Ids.length) {
      enqueueSnackBar(
        `Successfully deleted ${Ids.length} candidate${Ids.length === 1 ? '' : 's'} and their associated people`,
        {
          variant: SnackBarVariant.Success,
          duration: 3000,
        }
      );
      onSuccess?.();
    } else {
      const failedCount = Ids.length - successfulDeletions.length;
      throw new Error(
        `Failed to delete ${failedCount} candidate${failedCount === 1 ? '' : 's'} and their associated people`
      );
    }

    return results;
  } catch (err) {
    const errorMessage = err instanceof Error 
      ? err.message 
      : 'Failed to delete candidates and their associated people';
    
    const error = new Error(errorMessage);
    setError(error);
    
    enqueueSnackBar(errorMessage, {
      variant: SnackBarVariant.Error,
      duration: 5000,
    });

    onError?.(error);
    throw error;
  } finally {
    setLoading(false);
  }
};


return {
  deleteCandidatesAndPeople,
  loading,
  error,
};

}