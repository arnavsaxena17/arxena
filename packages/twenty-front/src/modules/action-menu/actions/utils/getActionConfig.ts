import { CANDIDATE_SPECIFIC_ACTIONS } from '@/action-menu/actions/record-actions/constants/CandidateActionsConfig';
import { DEFAULT_ACTIONS_CONFIG_V1 } from '@/action-menu/actions/record-actions/constants/DefaultActionsConfigV1';
import { DEFAULT_ACTIONS_CONFIG_V2 } from '@/action-menu/actions/record-actions/constants/DefaultActionsConfigV2';
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
      // console.log("This is the objectMetadataItem:", objectMetadataItem, "This is the baseConfig:", baseConfig, "This is the CANDIDATE_SPECIFIC_ACTIONS:", CANDIDATE_SPECIFIC_ACTIONS);
      const candidateSpecificActions = { ...baseConfig, ...CANDIDATE_SPECIFIC_ACTIONS };
      console.log("This is the candidateSpecificActions:", candidateSpecificActions);
      return candidateSpecificActions;
    }

    // if (objectMetadataItem.nameSingular === 'job') {
    //   return { ...baseConfig, ...JOB_SPECIFIC_ACTIONS };
    // }
    
    // if (objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')) {
    //   return { ...baseConfig, ...JOB_CANDIDATE_SPECIFIC_ACTIONS };
    // }
    // if (objectMetadataItem.nameSingular.toLowerCase().includes('videoInterview')) {
    //   return { ...baseConfig, ...VIDEO_INTERVIEW_SPECIFIC_ACTIONS };
    // }
    // if (objectMetadataItem.nameSingular.toLowerCase().includes('phoneCall')) {
    //   return { ...baseConfig, ...PHONE_CALL_SPECIFIC_ACTIONS };
    // }
    
    // if (objectMetadataItem.nameSingular.toLowerCase().includes('person')) {
    //   return { ...baseConfig, ...PERSON_SPECIFIC_ACTIONS };
    // }
    
    return baseConfig;
      
  }
};
