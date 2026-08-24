import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const CREATE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'create-video-interview-links-effect',
  });

const CreateVideoInterviewLinks = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/create-video-interview-links',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Video interview links created.',
          errorMessage: 'Failed to create video interview links.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    CREATE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-video-interview-links-effect',
  description: 'Creates video interview links for selected candidates',
  component: CreateVideoInterviewLinks,
  isHeadless: true,
});
