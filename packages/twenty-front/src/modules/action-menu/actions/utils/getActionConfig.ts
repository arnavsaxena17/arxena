import { CANDIDATE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/CandidateActionsConfig';
import { DEFAULT_ACTIONS_CONFIG_V1 } from '@/action-menu/actions/record-actions/constants/DefaultActionsConfigV1';
// import { DEFAULT_ACTIONS_CONFIG_V2 } from '@/action-menu/actions/record-actions/constants/DefaultActionsConfigV2';
import { JOB_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/JobActionsConfig';
import { JOB_CANDIDATE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/JobCandidateActionsConfig';
import { PEOPLE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/PeopleActionsConfig';
import { PHONE_CALL_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/PhoneCallActionsConfig';
import { VIDEO_INTERVIEW_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/VideoInterviewActionsConfig';
import { WORKFLOW_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/WorkflowActionsConfig';
import { WORKFLOW_RUNS_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/WorkflowRunsActionsConfig';
import { WORKFLOW_VERSIONS_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/WorkflowVersionsActionsConfig';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';

export const getActionConfig = (objectMetadataItem: ObjectMetadataItem) => {
  let baseConfig;
  switch (objectMetadataItem.nameSingular) {

    case CoreObjectNameSingular.Workflow:
      console.log('Getting here for workflow');
      baseConfig = WORKFLOW_ACTIONS_CONFIG;
      break;

    case CoreObjectNameSingular.WorkflowVersion:
      console.log('Getting here for workflow version');
      baseConfig = WORKFLOW_VERSIONS_ACTIONS_CONFIG;
      break;
    case CoreObjectNameSingular.WorkflowRun:
      console.log('Getting here for workflow run');
      baseConfig = WORKFLOW_RUNS_ACTIONS_CONFIG;
      break;
    default:
      console.log('Getting here for default');
      baseConfig = DEFAULT_ACTIONS_CONFIG_V1

      console.log(
        'Got here for actions. The object metadata item is::',
        objectMetadataItem,
      );
      if (objectMetadataItem.nameSingular === 'candidate') {
        return { ...baseConfig, ...CANDIDATE_SPECIFIC_ACTIONS };
      }
      console.log(
        'Current objectMetadataItem.nameSingular::',
        objectMetadataItem.nameSingular,
      );

      if (objectMetadataItem.nameSingular === 'job') {
        const jobSpecificActions = { ...baseConfig, ...JOB_SPECIFIC_ACTIONS };
        console.log('The job specific actions are::', jobSpecificActions);
        return jobSpecificActions;
      }
      if (objectMetadataItem.nameSingular === 'person') {
        console.log('Got here for setting people specific zctions');
        return { ...baseConfig, ...PEOPLE_SPECIFIC_ACTIONS };
      }

      if (
        objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      ) {
        return { ...baseConfig, ...JOB_CANDIDATE_SPECIFIC_ACTIONS };
      }

      if (
        objectMetadataItem.nameSingular.toLowerCase().includes('videointerview')
      ) {
        console.log('Getting here for video interview or not');
        return { ...baseConfig, ...VIDEO_INTERVIEW_SPECIFIC_ACTIONS };
      }

      if (objectMetadataItem.nameSingular.toLowerCase().includes('phonecall')) {
        return { ...baseConfig, ...PHONE_CALL_SPECIFIC_ACTIONS };
      }

      return baseConfig;
  }
};
