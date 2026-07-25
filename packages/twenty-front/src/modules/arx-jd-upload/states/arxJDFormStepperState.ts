import { projectIdAtom, projectsState } from '@/candidate-table/states/states';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import { createAtomWritableSelector } from '@/ui/utilities/state/jotai/utils/createAtomWritableSelector';
import { ParsedJD } from '../types/ParsedJD';
import {
  ProjectForParsedJDMerge,
  mergeParsedJDFromSources,
} from '../utils/mergeParsedJDFromSources';
import {
  arxUploadJDModalModeState,
  isArxUploadJDModalOpenState,
} from './arxUploadJDModalOpenState';

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

export const arxJDFormStepperState = createAtomState<ArxJDFormStepperState>({
  key: 'arxJDFormStepperState',
  defaultValue: {
    activeStep: 0,
  },
});

// Internal atom for storing user/AI-populated data - exported for job state reset
export const parsedJDInternalState = createAtomState<ParsedJD | null>({
  key: 'parsedJDInternalState',
  defaultValue: null,
});

// Writable selector: merges job data with user/AI data when candidate-table atoms are Jotai.
export const parsedJDSelector = createAtomWritableSelector<ParsedJD | null>({
  key: 'parsedJDSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState) as ProjectForParsedJDMerge[];
    const userData = get(parsedJDInternalState);
    const modalMode = get(arxUploadJDModalModeState);
    const isModalOpen = get(isArxUploadJDModalOpenState);

    return mergeParsedJDFromSources({
      projectId,
      projects,
      userData,
      modalMode,
      isModalOpen,
    });
  },
  set: ({ set }, newValue) => {
    set(parsedJDInternalState, newValue);
  },
});

export type UploadedJDState = {
  jobCode: string;
  jobName: string;
  jobDescription: string;
  jobLocation: string;
  jobSalary: string;
};
