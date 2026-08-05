import { type TabPresentation } from '@/page-layout/types/TabPresentation';
import { PageLayoutType } from '~/generated-metadata/graphql';
import { type WidgetCardVariant } from '~/modules/page-layout/widgets/types/WidgetCardVariant';

type GetWidgetCardVariantParams = {
  presentation: TabPresentation;
  isInPinnedTab: boolean;
  pageLayoutType: PageLayoutType | null;
  isMobile: boolean;
  isInSidePanel: boolean;
};

export const getWidgetCardVariant = ({
  presentation,
  isInPinnedTab,
  pageLayoutType,
  isMobile,
  isInSidePanel,
}: GetWidgetCardVariantParams): WidgetCardVariant => {
  const isSideColumnContext = isInPinnedTab || isMobile || isInSidePanel;

  // Solo is full-bleed on wide record pages, but in a narrow side column
  // (side panel / mobile / pinned tab) it needs the same inset as stacked
  // widgets so field values are not flush against the edge.
  if (presentation === 'solo') {
    const isRecordPageLayout =
      pageLayoutType === PageLayoutType.RECORD_PAGE ||
      pageLayoutType === PageLayoutType.RECORD_INDEX ||
      pageLayoutType === null;

    if (isSideColumnContext && isRecordPageLayout) {
      return 'side-column';
    }

    return 'solo';
  }

  switch (pageLayoutType) {
    case PageLayoutType.DASHBOARD:
      return 'dashboard';
    case PageLayoutType.STANDALONE_PAGE:
      return 'standalone';
    case PageLayoutType.RECORD_PAGE:
    case PageLayoutType.RECORD_INDEX:
    case null:
      return isSideColumnContext ? 'side-column' : 'record-page';
  }
};
