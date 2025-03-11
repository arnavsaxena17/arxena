import { atom } from 'recoil';

export enum ArxJDFormStepType {
  UploadJD = 'uploadJD',
  JobDetails = 'jobDetails',
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
