import axios from 'axios';
import mongoose from 'mongoose';

import { isDefined } from 'twenty-shared';

export const sendJobToArxena = async (
  jobName: string,
  jobId: string,
  accessToken: string,
  setError?: (error: string) => void,
) => {
  try {
    const arxenaJobId = new mongoose.Types.ObjectId().toString();

    const response = await axios.post(
      process.env.NODE_ENV === 'production'
        ? 'https://app.arxena.com/candidate-sourcing/create-job-in-arxena-and-sheets'
        : 'http://localhost:3000/candidate-sourcing/create-job-in-arxena-and-sheets',
      { job_name: jobName, new_job_id: arxenaJobId, id_to_update: jobId },
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
