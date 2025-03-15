// Create a new utility function for job matching
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import levenshtein from 'js-levenshtein';

type Job = ObjectRecord & {
  name: string;
  company?: {
    name?: string;
  };
};

export const findJobMatch = (jobName: string, availableJobs: Job[]) => {
  if (!jobName || !availableJobs?.length) return null;
  console.log('Finding job match for:', jobName);
  console.log('Available jobs:', availableJobs);
  const bestMatch = availableJobs.reduce<{ job: Job; distance: number } | null>(
    (best, job) => {
      const distance = levenshtein(
        job.name.toLowerCase(),
        jobName.toLowerCase(),
      );
      if (!best || distance < best.distance) {
        return { job, distance };
      }
      console.log('Best match:', best);
      return best;
    },
    null,
  );
  console.log('Best match:', bestMatch);

  if (!bestMatch || bestMatch.distance > 5) {
    console.log('No best match found or distance too high');
    return null;
  }

  return bestMatch.job;
};

export const useFindAllJobs = () => {
  const {
    records: jobs,
    loading,
    error,
  } = useFindManyRecords<Job>({
    objectNameSingular: 'job',
    limit: 50,
  });
  console.log('Jobs::', jobs);

  return { jobs, loading, error };
};

export const useJobMatcher = (jobName: string) => {
  const { jobs: availableJobs, loading, error } = useFindAllJobs();

  const matchedJob = findJobMatch(jobName, availableJobs ?? []);

  return { matchedJob, loading, error };
};
