import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const POPULATE_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'populate-shortlist-effect',
  });

const PopulateShortlist = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/populate-shortlist',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Shortlist records populated.',
          errorMessage: 'Failed to populate shortlist records.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    POPULATE_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'populate-shortlist-effect',
  description: 'Populates shortlist records for selected candidates',
  component: PopulateShortlist,
  isHeadless: true,
});
