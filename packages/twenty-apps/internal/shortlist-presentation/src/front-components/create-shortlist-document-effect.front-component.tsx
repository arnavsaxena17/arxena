import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const CREATE_SHORTLIST_DOCUMENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'create-shortlist-document-effect',
  });

const CreateShortlistDocument = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/create-shortlist-document',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Shortlist PDF and Excel created.',
          errorMessage: 'Failed to create shortlist PDF and Excel.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    CREATE_SHORTLIST_DOCUMENT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-shortlist-document-effect',
  description: 'Creates shortlist PDF and Excel for selected candidates',
  component: CreateShortlistDocument,
  isHeadless: true,
});
