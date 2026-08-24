import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { getFrontComponentUniversalIdentifier } from 'twenty-shared/application';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/application';
import { requestAppRoute } from 'src/front-components/utils/request-app-route.util';

export const SHARE_CHAT_BASED_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER =
  getFrontComponentUniversalIdentifier({
    applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    componentName: 'share-chat-based-shortlist-effect',
  });

const ShareChatBasedShortlist = () => {
  const candidateIds = useSelectedRecordIds();

  return (
    <Command
      execute={() =>
        requestAppRoute({
          path: '/share-chat-based-shortlist',
          body: {
            records: candidateIds.map((id) => ({ id })),
          },
          successMessage: 'Chat-based shortlist shared.',
          errorMessage: 'Failed to share chat-based shortlist.',
        })
      }
    />
  );
};

export default defineFrontComponent({
  universalIdentifier:
    SHARE_CHAT_BASED_SHORTLIST_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'share-chat-based-shortlist-effect',
  description: 'Shares chat-based shortlist for selected candidates',
  component: ShareChatBasedShortlist,
  isHeadless: true,
});
