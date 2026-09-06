import { tokenPairState } from '@/auth/states/tokenPairState';
import { type DeletePeopleAndCandidatesPayload } from '@/command-menu-item/engine-command/record/arx/utils/build-delete-people-and-candidates-payload.util';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useState } from 'react';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type UseExecuteDeleteCandidatesAndPeopleParams = {
  objectNameSingular: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onRefresh?: () => void;
};

type DeleteCandidatesAndPeopleInput =
  | string[]
  | DeletePeopleAndCandidatesPayload;

const buildRequestBody = ({
  input,
  objectNameSingular,
}: {
  input: DeleteCandidatesAndPeopleInput;
  objectNameSingular: string;
}): { candidateIds?: string[]; personIds?: string[] } => {
  if (Array.isArray(input)) {
    return objectNameSingular === 'candidate'
      ? { candidateIds: input }
      : { personIds: input };
  }

  const body: { candidateIds?: string[]; personIds?: string[] } = {};

  if (input.personIds.length > 0) {
    body.personIds = input.personIds;
  }

  if (input.candidateIds.length > 0) {
    body.candidateIds = input.candidateIds;
  }

  return body;
};

export const useExecuteDeleteCandidatesAndPeople = ({
  objectNameSingular,
  onSuccess,
  onError,
  onRefresh,
}: UseExecuteDeleteCandidatesAndPeopleParams) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const tokenPair = useAtomStateValue(tokenPairState);
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
  } = useSnackBar();

  const deleteCandidatesAndPeople = async (
    input: DeleteCandidatesAndPeopleInput,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const url = `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/delete-people-and-candidates-bulk`;
      const body = buildRequestBody({ input, objectNameSingular });

      if (!body.personIds?.length && !body.candidateIds?.length) {
        throw new Error('No valid people or candidate IDs to delete');
      }

      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          'Content-Type': 'application/json',
        },
      });

      const { status, message, results } = response.data;

      if (status === 'Success') {
        enqueueSuccessSnackBar({ message, options: { duration: 3000 } });
        onSuccess?.();
        onRefresh?.();
      } else if (status === 'Partial') {
        enqueueWarningSnackBar({ message, options: { duration: 5000 } });
        onSuccess?.();
        onRefresh?.();
      } else {
        throw new Error(message ?? 'Failed to delete items');
      }

      return results;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete items';

      const nextError = new Error(errorMessage);
      setError(nextError);

      enqueueErrorSnackBar({
        message: errorMessage,
        options: { duration: 5000 },
      });

      onError?.(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  };

  return {
    deleteCandidatesAndPeople,
    loading,
    error,
  };
};
