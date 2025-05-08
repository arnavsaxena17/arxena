import axios from 'axios';
import { isDefined } from 'twenty-shared';

export const sendUpdateJobToArxena = async (
  jobName: string,
  arxenaSiteId: string,
  accessToken: string,
  setError?: (error: string) => void,
) => {
  try {
    console.log('updating job in arxena in sendUpdateJobToArxena::');
    console.log('jobName::', jobName);
    console.log('arxenaSiteId::', arxenaSiteId);
    
    const response = await axios.post(
      process.env.NODE_ENV === 'production'
        ? 'https://app.arxena.com/candidate-sourcing/update-job-in-arxena-and-sheets'
        : 'http://localhost:3000/candidate-sourcing/update-job-in-arxena-and-sheets',
      { job_name: jobName, arxena_site_id: arxenaSiteId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.status !== 200) {
      throw new Error(`Failed to update job on Arxena: ${response.statusText}`);
    }
    return response.data;
  } catch (error) {
    console.error('Error updating job in Arxena:', error);
    if (isDefined(setError)) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update job on Arxena',
      );
    }
    return null;
  }
}; 