import { CANDIDATE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/CandidateActionsConfig';
import { DEFAULT_ACTIONS_CONFIG_V1 } from '@/action-menu/actions/record-actions/constants/DefaultActionsConfigV1';
import { DEFAULT_ACTIONS_CONFIG_V2 } from '@/action-menu/actions/record-actions/constants/DefaultActionsConfigV2';
import { JOB_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/JobActionsConfig';
// import { JOB_CANDIDATE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/JobCandidateActionsConfig';
import { PEOPLE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/PeopleActionsConfig';
import { PHONE_CALL_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/PhoneCallActionsConfig';
import { VIDEO_INTERVIEW_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/VideoInterviewActionsConfig';
import { WORKFLOW_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/WorkflowActionsConfig';
import { WORKFLOW_RUNS_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/WorkflowRunsActionsConfig';
import { WORKFLOW_VERSIONS_ACTIONS_CONFIG } from '@/action-menu/actions/record-actions/constants/WorkflowVersionsActionsConfig';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';

export const getActionConfig = (
  objectMetadataItem: ObjectMetadataItem,
  isCommandMenuV2Enabled: boolean,
) => {
  // console.log("the value of isCommandMenuV2Enabled::", isCommandMenuV2Enabled)
  // isCommandMenuV2Enabled = true;

  let baseConfig;

  switch (objectMetadataItem.nameSingular) {
    case CoreObjectNameSingular.Workflow:
      baseConfig = WORKFLOW_ACTIONS_CONFIG;
      break;

    case CoreObjectNameSingular.WorkflowVersion:
      baseConfig = WORKFLOW_VERSIONS_ACTIONS_CONFIG;
      break;
    case CoreObjectNameSingular.WorkflowRun:
      baseConfig = WORKFLOW_RUNS_ACTIONS_CONFIG;
      break;
    default:
      baseConfig = isCommandMenuV2Enabled
        ? DEFAULT_ACTIONS_CONFIG_V1
        : DEFAULT_ACTIONS_CONFIG_V2;

      if (objectMetadataItem.nameSingular === 'candidate') {
        console.log("Called the getActionConfig function for candidate");
        const candidateSpecificActions = { ...baseConfig, ...CANDIDATE_SPECIFIC_ACTIONS };
        console.log("The candidateSpecificActions are::", candidateSpecificActions);
        return candidateSpecificActions;
      }


      if (objectMetadataItem.nameSingular === 'job') {
        const jobSpecificActions = { ...baseConfig, ...JOB_SPECIFIC_ACTIONS };
        return jobSpecificActions;
      }
      if (objectMetadataItem.nameSingular === 'person') {
        return { ...baseConfig, ...PEOPLE_SPECIFIC_ACTIONS };
      }

      // if (
      //     objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      //   ) {
      //     return { ...baseConfig, ...JOB_CANDIDATE_SPECIFIC_ACTIONS };
      //   }

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
