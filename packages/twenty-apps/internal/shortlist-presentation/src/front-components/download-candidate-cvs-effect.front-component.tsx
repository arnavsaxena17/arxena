import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const DOWNLOAD_CANDIDATE_CVS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'download-candidate-cvs-effect',
  });

const DownloadCandidateCvs = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/download-candidate-cvs',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Candidate CV download requested.',
          errorMessage: 'Failed to download candidate CVs.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    DOWNLOAD_CANDIDATE_CVS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'download-candidate-cvs-effect',
  description: 'Downloads CVs for selected candidates',
  component: DownloadCandidateCvs,
  isHeadless: true,
});
