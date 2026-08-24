import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const DOWNLOAD_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'download-shortlist-effect',
  });

const DownloadShortlist = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/download-shortlist',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Shortlist download requested.',
          errorMessage: 'Failed to download shortlist.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    DOWNLOAD_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'download-shortlist-effect',
  description: 'Downloads shortlist documents for selected candidates',
  component: DownloadShortlist,
  isHeadless: true,
});
