import { t } from '@lingui/core/macro';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { AppPath, ContextStorePageType } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { type BrowsingContext } from '@/ai/types/BrowsingContext';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentObjectMetadataItemIdComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemIdComponentState';
import { contextStoreCurrentPageTypeComponentState } from '@/context-store/states/contextStoreCurrentPageTypeComponentState';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { orgChartBrowsingContextState } from '@/orgchart/states/orgChartBrowsingContextState';
import { OUTREACH_PROJECT_ID_QUERY_PARAM } from '@/outreach-home/constants/outreach-command.constants';
import {
  DEFAULT_OUTREACH_CONTEXT,
  outreachContextState,
} from '@/outreach-home/states/outreachContextState';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { getTabListInstanceIdFromPageLayoutId } from '@/page-layout/utils/getTabListInstanceIdFromPageLayoutId';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isAiChatPath } from '~/utils/isAiChatPath';
import { viewFromViewIdFamilySelector } from '@/views/states/selectors/viewFromViewIdFamilySelector';

const isOutreachHomePath = (pathname: string): boolean =>
  pathname === `/${AppPath.OutreachHome}` ||
  pathname.endsWith(`/${AppPath.OutreachHome}`) ||
  pathname.includes(`/${AppPath.OutreachHome}/`);

const isOrgChartPath = (pathname: string): boolean =>
  pathname === `/${AppPath.OrgChart}` ||
  pathname.startsWith(`/${AppPath.OrgChart}/`);

export const useGetBrowsingContext = () => {
  const store = useStore();
  const location = useLocation();
  const outreachContext = useAtomStateValue(outreachContextState);
  const orgChartBrowsingContext = useAtomStateValue(
    orgChartBrowsingContextState,
  );

  const getBrowsingContext = useCallback((): BrowsingContext | null => {
    const projectIdFromRoute =
      matchPath(`/${AppPath.Project}/*`, location.pathname)?.params.projectId ??
      new URLSearchParams(location.search).get(OUTREACH_PROJECT_ID_QUERY_PARAM);

    // The outreach context atom can be stale from another project, so on a
    // project page only trust it when it belongs to the project in the URL.
    const isOutreachContextForRoute =
      !isDefined(projectIdFromRoute) ||
      outreachContext.projectId === projectIdFromRoute;

    // The full-page chat has no project in its URL; fall back to the last
    // project the user opened (the atom is never reset on navigation).
    const isChatPageWithLastProject =
      isAiChatPath(location.pathname) && isDefined(outreachContext.projectId);

    if (
      isOutreachHomePath(location.pathname) ||
      isDefined(matchPath(`/${AppPath.Project}/*`, location.pathname)) ||
      isChatPageWithLastProject
    ) {
      const activeOutreachContext = isOutreachContextForRoute
        ? outreachContext
        : DEFAULT_OUTREACH_CONTEXT;

      return {
        type: 'outreachCommand',
        projectId: projectIdFromRoute ?? outreachContext.projectId,
        projectName: activeOutreachContext.projectName,
        outreachWorkflowId: activeOutreachContext.outreachWorkflowId,
        outreachSendMode: activeOutreachContext.outreachSendMode,
        phase: activeOutreachContext.phase,
        activeTab: activeOutreachContext.activeTab,
        selectedCompanyId: activeOutreachContext.selectedCompanyId,
        selectedPersonId: activeOutreachContext.selectedPersonId,
        selectedPersonIds: activeOutreachContext.selectedPersonIds,
        selectedCandidateIds: activeOutreachContext.selectedCandidateIds,
        icpName: activeOutreachContext.icpName,
        icpSpecSummary: activeOutreachContext.icpSpecSummary,
        linkedinConnected: activeOutreachContext.linkedinConnected,
        gmailConnected: activeOutreachContext.gmailConnected,
        whatsappConnected: activeOutreachContext.whatsappConnected,
      };
    }

    if (isOrgChartPath(location.pathname)) {
      return {
        type: 'orgChart',
        companyId: orgChartBrowsingContext?.companyId ?? null,
        companyName: orgChartBrowsingContext?.companyName ?? null,
        country: orgChartBrowsingContext?.country ?? null,
        functionRoot: orgChartBrowsingContext?.functionRoot ?? null,
        titleQuery: orgChartBrowsingContext?.titleQuery ?? null,
        searchTerm: orgChartBrowsingContext?.searchTerm ?? null,
      };
    }

    const instanceId = MAIN_CONTEXT_STORE_INSTANCE_ID;

    const pageType = store.get(
      contextStoreCurrentPageTypeComponentState.atomFamily({
        instanceId,
      }),
    );

    const viewType = store.get(
      contextStoreCurrentViewTypeComponentState.atomFamily({
        instanceId,
      }),
    );

    const objectMetadataItemId = store.get(
      contextStoreCurrentObjectMetadataItemIdComponentState.atomFamily({
        instanceId,
      }),
    );

    const objectMetadataItems = store.get(objectMetadataItemsSelector.atom);

    const objectMetadataItem = objectMetadataItems.find(
      (item) => item.id === objectMetadataItemId,
    );

    if (!objectMetadataItem) {
      return null;
    }

    if (pageType === ContextStorePageType.Record) {
      const targetedRecordsRule = store.get(
        contextStoreTargetedRecordsRuleComponentState.atomFamily({
          instanceId,
        }),
      );

      if (
        targetedRecordsRule.mode !== 'selection' ||
        targetedRecordsRule.selectedRecordIds.length !== 1
      ) {
        return null;
      }

      const recordContext: BrowsingContext = {
        type: 'recordPage',
        objectNameSingular: objectMetadataItem.nameSingular,
        recordId: targetedRecordsRule.selectedRecordIds[0],
      };

      const pageLayoutId = store.get(
        recordStoreFamilySelector.selectorFamily({
          recordId: targetedRecordsRule.selectedRecordIds[0],
          fieldName: 'pageLayoutId',
        }),
      ) as string | null | undefined;

      if (isDefined(pageLayoutId)) {
        const tabListInstanceId =
          getTabListInstanceIdFromPageLayoutId(pageLayoutId);
        const activeTabId = store.get(
          activeTabIdComponentState.atomFamily({
            instanceId: tabListInstanceId,
          }),
        );

        return {
          ...recordContext,
          pageLayoutId,
          activeTabId,
        };
      }

      return recordContext;
    }

    if (
      viewType === ContextStoreViewType.Table ||
      viewType === ContextStoreViewType.Kanban
    ) {
      const currentViewId = store.get(
        contextStoreCurrentViewIdComponentState.atomFamily({
          instanceId,
        }),
      );

      const currentView = store.get(
        viewFromViewIdFamilySelector.selectorFamily({
          viewId: currentViewId ?? '',
        }),
      );

      if (!currentView) {
        return null;
      }

      const contextStoreFilters = store.get(
        contextStoreFiltersComponentState.atomFamily({
          instanceId,
        }),
      );

      const filterDescriptions = contextStoreFilters.map(
        (filter: {
          fieldMetadataId: string;
          operand: string;
          displayValue: string;
        }) => {
          const fieldMetadataItem = objectMetadataItem.fields.find(
            (field) => field.id === filter.fieldMetadataId,
          );
          const fieldLabel = fieldMetadataItem?.label ?? t`Unknown field`;

          return `${fieldLabel} ${filter.operand} "${filter.displayValue}"`;
        },
      );

      return {
        type: 'listView',
        objectNameSingular: objectMetadataItem.nameSingular,
        viewId: currentView.id,
        viewName: currentView.name,
        filterDescriptions,
      };
    }

    return null;
  }, [
    outreachContext,
    orgChartBrowsingContext,
    location.pathname,
    location.search,
    store,
  ]);

  return { getBrowsingContext };
};
