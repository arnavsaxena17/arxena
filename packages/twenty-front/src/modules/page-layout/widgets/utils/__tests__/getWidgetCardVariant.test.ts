import { getWidgetCardVariant } from '@/page-layout/widgets/utils/getWidgetCardVariant';
import { PageLayoutType, WidgetType } from '~/generated-metadata/graphql';

const baseParams = {
  isInPinnedTab: false,
  isMobile: false,
  isInSidePanel: false,
};

describe('getWidgetCardVariant', () => {
  describe('when presentation is solo', () => {
    it.each([
      PageLayoutType.RECORD_PAGE,
      PageLayoutType.STANDALONE_PAGE,
      PageLayoutType.DASHBOARD,
      PageLayoutType.RECORD_INDEX,
    ])(
      "returns 'solo' on wide layout regardless of pageLayoutType (%s)",
      (pageLayoutType) => {
        expect(
          getWidgetCardVariant({
            ...baseParams,
            presentation: 'solo',
            pageLayoutType,
          }),
        ).toBe('solo');
      },
    );

    it.each([
      ['isInPinnedTab', { isInPinnedTab: true }],
      ['isMobile', { isMobile: true }],
      ['isInSidePanel', { isInSidePanel: true }],
    ])(
      "returns 'side-column' for record pages when %s is true",
      (_label, override) => {
        expect(
          getWidgetCardVariant({
            ...baseParams,
            ...override,
            presentation: 'solo',
            pageLayoutType: PageLayoutType.RECORD_PAGE,
          }),
        ).toBe('side-column');
      },
    );

    it("returns 'record-page' for solo Fields on wide record pages", () => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          presentation: 'solo',
          pageLayoutType: PageLayoutType.RECORD_PAGE,
          widgetType: WidgetType.FIELDS,
        }),
      ).toBe('record-page');
    });

    it("keeps 'solo' for non-Fields widgets on wide record pages", () => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          presentation: 'solo',
          pageLayoutType: PageLayoutType.RECORD_PAGE,
          widgetType: WidgetType.TIMELINE,
        }),
      ).toBe('solo');
    });

    it("keeps 'solo' for dashboard even in side panel", () => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          isInSidePanel: true,
          presentation: 'solo',
          pageLayoutType: PageLayoutType.DASHBOARD,
        }),
      ).toBe('solo');
    });
  });

  describe('when presentation is stack', () => {
    it("returns 'dashboard' for DASHBOARD page", () => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          presentation: 'stack',
          pageLayoutType: PageLayoutType.DASHBOARD,
        }),
      ).toBe('dashboard');
    });

    it("returns 'standalone' for STANDALONE_PAGE", () => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          presentation: 'stack',
          pageLayoutType: PageLayoutType.STANDALONE_PAGE,
        }),
      ).toBe('standalone');
    });

    it("returns 'record-page' for RECORD_PAGE by default", () => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          presentation: 'stack',
          pageLayoutType: PageLayoutType.RECORD_PAGE,
        }),
      ).toBe('record-page');
    });
  });

  describe('side-column context for record pages', () => {
    it.each([
      ['isInPinnedTab', { isInPinnedTab: true }],
      ['isMobile', { isMobile: true }],
      ['isInSidePanel', { isInSidePanel: true }],
    ])("returns 'side-column' when %s is true", (_label, override) => {
      expect(
        getWidgetCardVariant({
          ...baseParams,
          ...override,
          presentation: 'stack',
          pageLayoutType: PageLayoutType.RECORD_PAGE,
        }),
      ).toBe('side-column');
    });
  });
});
