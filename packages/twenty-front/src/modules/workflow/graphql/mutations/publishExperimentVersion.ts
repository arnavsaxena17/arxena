import { gql } from '@apollo/client';

export const PUBLISH_EXPERIMENT_VERSION = gql`
  mutation PublishExperimentVersion($workflowVersionId: UUID!) {
    publishExperimentVersion(workflowVersionId: $workflowVersionId)
  }
`;
