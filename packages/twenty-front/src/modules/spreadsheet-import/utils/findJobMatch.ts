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
  console.log('Finding job match for:', jobName);
  console.log('Available jobs:', availableJobs);
  if (!jobName || !availableJobs?.length) return null;
  console.log('Finding job match for:', jobName);
  console.log('Available jobs:', availableJobs);
  
  // First try exact match (case-insensitive)
  const exactMatch = availableJobs.find(
    job => job.name.toLowerCase().trim() === jobName.toLowerCase().trim()
  );
  
  if (exactMatch) {
    console.log('Exact match found:', exactMatch.name);
    return exactMatch;
  }
  
  // Then try partial match (contains)
  const partialMatch = availableJobs.find(
    job => job.name.toLowerCase().includes(jobName.toLowerCase()) ||
            jobName.toLowerCase().includes(job.name.toLowerCase())
  );
  
  if (partialMatch) {
    console.log('Partial match found:', partialMatch.name);
    return partialMatch;
  }
  
  // Finally try Levenshtein distance with higher threshold
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

  // Increased threshold from 5 to 15 for better matching
  if (!bestMatch || bestMatch.distance > 15) {
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
  console.log('Jobs found in useFindAllJobs::', jobs);

  return { jobs, loading, error };
};

// export const useJobMatcher = (jobName: string) => {
//   const { jobs: availableJobs, loading, error } = useFindAllJobs();
//   console.log('Available jobs in useJobMatcher::', availableJobs);
//   const matchedJob = findJobMatch(jobName, availableJobs ?? []);
//   console.log('Matched job in useJobMatcher::', matchedJob);
//   return { matchedJob, loading, error };
// };
