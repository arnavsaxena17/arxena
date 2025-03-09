import axios from 'axios';
import { isDefined } from 'twenty-shared';

type DeleteJobFromArxenaParams = {
  arxenaSiteId: string | undefined | null;
  accessToken: string | undefined;
  delayInMsBetweenRequests?: number;
};

export const getArxenaApiUrl = () => {
  return process.env.NODE_ENV === 'production'
    ? 'https://app.arxena.com/candidate-sourcing/delete-job-in-arxena-and-sheets'
    : 'http://localhost:3000/candidate-sourcing/delete-job-in-arxena-and-sheets';
};

export const deleteJobFromArxena = async ({
  arxenaSiteId,
  accessToken,
  delayInMsBetweenRequests,
}: DeleteJobFromArxenaParams): Promise<void> => {
  if (!isDefined(arxenaSiteId) || !isDefined(accessToken)) {
    return;
  }
  console.log('Deleting job from Arxena:', arxenaSiteId);
  const response = await axios.post(
    getArxenaApiUrl(),
    { id_to_delete: arxenaSiteId },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Failed to delete job from Arxena: ${response.statusText}`);
  }

  // Add delay between requests if specified
  if (
    delayInMsBetweenRequests !== undefined &&
    delayInMsBetweenRequests !== null
  ) {
    await new Promise((resolve) =>
      setTimeout(resolve, delayInMsBetweenRequests),
    );
  }
};
