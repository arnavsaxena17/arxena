import { t } from '@lingui/core/macro';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
import { gtmCommandContextState } from '@/gtm-home/states/gtmCommandContextState';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { getTabListInstanceIdFromPageLayoutId } from '@/page-layout/utils/getTabListInstanceIdFromPageLayoutId';
import { activeTabIdComponentState } from '@/ui/layout/tab-list/states/activeTabIdComponentState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { viewFromViewIdFamilySelector } from '@/views/states/selectors/viewFromViewIdFamilySelector';

const isGtmHomePath = (pathname: string): boolean =>
  pathname === `/${AppPath.GtmHome}` ||
  pathname.endsWith(`/${AppPath.GtmHome}`) ||
  pathname.includes(`/${AppPath.GtmHome}/`);

export const useGetBrowsingContext = () => {
  const store = useStore();
  const location = useLocation();
  const gtmCommandContext = useAtomStateValue(gtmCommandContextState);

  const getBrowsingContext = useCallback((): BrowsingContext | null => {
    if (isGtmHomePath(location.pathname)) {
      return {
        type: 'gtmCommand',
        projectId: gtmCommandContext.projectId,
        projectName: gtmCommandContext.projectName,
        gtmRunKey: gtmCommandContext.gtmRunKey,
        outreachWorkflowId: gtmCommandContext.outreachWorkflowId,
        outreachSendMode: gtmCommandContext.outreachSendMode,
        phase: gtmCommandContext.phase,
        selectedCompanyId: gtmCommandContext.selectedCompanyId,
        selectedPersonId: gtmCommandContext.selectedPersonId,
        icpName: gtmCommandContext.icpName,
        icpSpecSummary: gtmCommandContext.icpSpecSummary,
        linkedinConnected: gtmCommandContext.linkedinConnected,
        gmailConnected: gtmCommandContext.gmailConnected,
        whatsappConnected: gtmCommandContext.whatsappConnected,
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
  }, [gtmCommandContext, location.pathname, store]);

  return { getBrowsingContext };
};
