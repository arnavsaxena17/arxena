import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const SHARE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'share-video-interview-links-effect',
  });

const ShareVideoInterviewLinks = () => {
  const selectedIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/share-video-interview-links',
          body: {
            records: selectedIds.map((id) => ({ id })),
            recordObject: 'candidate',
          },
          successMessage: 'Video interview links shared.',
          errorMessage: 'Failed to share video interview links.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    SHARE_VIDEO_INTERVIEW_LINKS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'share-video-interview-links-effect',
  description: 'Shares video interview links with selected candidates',
  component: ShareVideoInterviewLinks,
  isHeadless: true,
});
