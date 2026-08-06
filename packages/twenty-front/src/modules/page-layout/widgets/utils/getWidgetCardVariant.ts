import { type TabPresentation } from '@/page-layout/types/TabPresentation';
import { PageLayoutType, WidgetType } from '~/generated-metadata/graphql';
import { type WidgetCardVariant } from '~/modules/page-layout/widgets/types/WidgetCardVariant';

type GetWidgetCardVariantParams = {
  presentation: TabPresentation;
  isInPinnedTab: boolean;
  pageLayoutType: PageLayoutType | null;
  isMobile: boolean;
  isInSidePanel: boolean;
  widgetType?: WidgetType;
};

export const getWidgetCardVariant = ({
  presentation,
  isInPinnedTab,
  pageLayoutType,
  isMobile,
  isInSidePanel,
  widgetType,
}: GetWidgetCardVariantParams): WidgetCardVariant => {
  const isSideColumnContext = isInPinnedTab || isMobile || isInSidePanel;

  // Solo is full-bleed on wide record pages for canvas-like widgets
  // (Timeline, Tasks, …). Fields have no internal horizontal padding, so
  // solo Fields need an inset variant or values sit flush against the edge.
  // Same inset applies in a narrow side column (side panel / mobile / pinned).
  if (presentation === 'solo') {
    const isRecordPageLayout =
      pageLayoutType === PageLayoutType.RECORD_PAGE ||
      pageLayoutType === PageLayoutType.RECORD_INDEX ||
      pageLayoutType === null;

    if (isSideColumnContext && isRecordPageLayout) {
      return 'side-column';
    }

    if (isRecordPageLayout && widgetType === WidgetType.FIELDS) {
      return 'record-page';
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
