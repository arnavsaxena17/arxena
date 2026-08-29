import { useMutation } from '@apollo/client/react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { modifyRecordFromCache } from '@/object-record/cache/utils/modifyRecordFromCache';
import { PUBLISH_EXPERIMENT_VERSION } from '@/workflow/graphql/mutations/publishExperimentVersion';
import { CoreObjectNameSingular } from 'twenty-shared/types';

type PublishExperimentVersionMutation = {
  publishExperimentVersion: boolean;
};

type PublishExperimentVersionMutationVariables = {
  workflowVersionId: string;
};

export const usePublishExperimentVersion = () => {
  const apolloCoreClient = useApolloCoreClient();
  const [mutate] = useMutation<
    PublishExperimentVersionMutation,
    PublishExperimentVersionMutationVariables
  >(PUBLISH_EXPERIMENT_VERSION, {
    client: apolloCoreClient,
  });

  const { objectMetadataItem: objectMetadataItemWorkflowVersion } =
    useObjectMetadataItem({
      objectNameSingular: CoreObjectNameSingular.WorkflowVersion,
    });

  const publishExperimentVersion = async ({
    workflowVersionId,
  }: {
    workflowVersionId: string;
  }) => {
    await mutate({
      variables: {
        workflowVersionId,
      },
      update: () => {
        modifyRecordFromCache({
          cache: apolloCoreClient.cache,
          recordId: workflowVersionId,
          objectMetadataItem: objectMetadataItemWorkflowVersion,
          fieldModifiers: {
            status: () => 'EXPERIMENT',
          },
        });
      },
    });
  };

  return { publishExperimentVersion };
};
