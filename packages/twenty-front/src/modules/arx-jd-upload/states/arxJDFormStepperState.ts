import { jobIdAtom, jobsState } from '@/candidate-table/states/states';
import { atom, selector } from 'recoil';
import { ParsedJD } from '../types/ParsedJD';

export enum ArxJDFormStepType {
  UploadJD = 'uploadJD',
  JobDetails = 'jobDetails',
  CandidateSearch = 'candidateSearch',
  ChatConfiguration = 'chatConfiguration',
  VideoInterview = 'videoInterview',
  MeetingScheduling = 'meetingScheduling',
}

export type ArxJDFormStepperState = {
  activeStep: number;
};
export const arxJDFormStepperState = atom<ArxJDFormStepperState>({
  key: 'arxJDFormStepperState',
  default: {
    activeStep: 0,
  },
});

// Replace the simple UploadedJDState with the comprehensive ParsedJD state
export const parsedJDState = atom<ParsedJD | null>({
  key: 'parsedJDState',
  default: null,
});

// Writable selector deriving parsedJD from jobsState/jobId and merging with parsedJDState.
// - get: returns a merged ParsedJD where data from parsedJDState overrides derived job fields
// - set: forwards writes to parsedJDState (source of truth for user edits and extended fields)
export const parsedJDSelector = selector<ParsedJD | null>({
  key: 'parsedJDSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const stored = get(parsedJDState);

    const job = jobs.find(j => j.id === jobId);

    if (!job && !stored) {
      return null;
    }

    const derivedFromJob: Partial<ParsedJD> | null = job
      ? {
          id: job.id,
          name: job.name,
          description: '',
          jobCode: '',
          jobLocation: job.jobLocation || '',
          salaryBracket: '',
          isActive: job.isActive,
          specificCriteria: '',
          pathPosition: job.pathPosition || '',
          companyName: '',
          companyId: '',
          companyDetails: '',
          filePath: '',
          parsedJobDescription: undefined as any,
          searchParameters: undefined as any,
          searchFilters: job.searchFilter?.edges?.map(edge => ({
            id: edge.node.id,
            name: edge.node.name,
            searchFilterParameter: edge.node.searchFilterParameter,
            searchFilterName: edge.node.searchFilterName,
            searchFilterFields: edge.node.searchFilterFields,
          })) || [],
          chatFlow: undefined as any,
          videoInterview: undefined as any,
          meetingScheduling: undefined as any,
          existingChatQuestions: undefined as any,
        }
      : null;

    // Merge precedence: stored (user/AI-populated) overrides derived job snapshot
    if (stored && derivedFromJob) {
      return { ...derivedFromJob, ...stored } as ParsedJD;
    }
    return (stored || (derivedFromJob as ParsedJD)) ?? null;
  },
  set: ({ set }, newValue) => {
    set(parsedJDState, newValue as ParsedJD | null);
  },
});

// Keep the old uploadedJDState for backward compatibility during transition
// TODO: Remove this after migration is complete
export type UploadedJDState = {
  jobCode: string;
  jobName: string;
  jobDescription: string;
  jobLocation: string;
  jobSalary: string;
};
