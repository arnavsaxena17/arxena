import axios from 'axios';
import { v4 } from 'uuid';

import { isDefined } from 'twenty-shared/utils';

export const sendCreateProjectToArxena = async (
  jobName: string,
  projectId: string,
  accessToken: string,
  setError?: (error: string) => void,
) => {
  try {
    console.log('sending job to arxena in sendProjectToArxena::');
    console.log('jobName::', jobName);
    console.log('projectId::', projectId);
    const arxenaSiteId = v4();
    console.log('arxenaSiteId::', arxenaSiteId);
    const response = await axios.post(
      process.env.NODE_ENV === 'production'
        ? 'https://app.arxena.com/candidate-sourcing/create-project-in-arxena-and-sheets'
        : 'http://localhost:3000/candidate-sourcing/create-project-in-arxena-and-sheets',
      { job_name: jobName, new_job_id: arxenaSiteId, id_to_update: projectId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`Failed to create job on Arxena: ${response.statusText}`);
    }
    return response.data;
  } catch (error) {
    console.error('Error sending job to Arxena:', error);
    if (isDefined(setError)) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to create job on Arxena',
      );
    }
    return null;
  }
};
