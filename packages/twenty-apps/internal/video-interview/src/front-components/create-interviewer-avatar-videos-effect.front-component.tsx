import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const CREATE_INTERVIEWER_AVATAR_VIDEOS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'create-interviewer-avatar-videos-effect',
  });

const CreateInterviewerAvatarVideos = () => {
  const projectIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/create-interviewer-avatar-videos',
          body: {
            records: projectIds.map((id) => ({ id })),
          },
          successMessage: 'Avatar video generation queued.',
          errorMessage: 'Failed to queue avatar video generation.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    CREATE_INTERVIEWER_AVATAR_VIDEOS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-interviewer-avatar-videos-effect',
  description: 'Queues interviewer avatar videos for selected projects',
  component: CreateInterviewerAvatarVideos,
  isHeadless: true,
});
