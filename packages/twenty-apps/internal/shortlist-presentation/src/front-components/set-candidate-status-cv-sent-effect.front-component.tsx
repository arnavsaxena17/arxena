import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const SET_CANDIDATE_STATUS_CV_SENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'set-candidate-status-cv-sent-effect',
  });

const SetCandidateStatusCvSent = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/set-candidate-status-cv-sent',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Candidate status set to CV Sent.',
          errorMessage: 'Failed to set candidate status to CV Sent.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    SET_CANDIDATE_STATUS_CV_SENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'set-candidate-status-cv-sent-effect',
  description: 'Sets selected candidates status to CV_SENT',
  component: SetCandidateStatusCvSent,
  isHeadless: true,
});
