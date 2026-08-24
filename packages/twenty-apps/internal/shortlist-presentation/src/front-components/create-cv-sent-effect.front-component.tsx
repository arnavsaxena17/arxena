import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const CREATE_CV_SENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'create-cv-sent-effect',
  });

const CreateCvSent = () => {
  const recordIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/create-cv-sent',
          body: {
            records: recordIds.map((id) => ({ id })),
          },
          successMessage: 'CV Sent record created.',
          errorMessage: 'Failed to create CV Sent record.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier: CREATE_CV_SENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-cv-sent-effect',
  description: 'Creates a CV Sent record for selected projects',
  component: CreateCvSent,
  isHeadless: true,
});
