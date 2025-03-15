import { useDeleteMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useDeleteMultipleRecordsAction';
import { useDestroyMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useDestroyMultipleRecordsAction';
import { useExportMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useExportMultipleRecordsAction';
import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { NoSelectionRecordActionKeys } from '@/action-menu/actions/record-actions/no-selection/types/NoSelectionRecordActionsKey';
import { useAddToFavoritesSingleRecordAction } from '@/action-menu/actions/record-actions/single-record/hooks/useAddToFavoritesSingleRecordAction';
import { useDeleteSingleRecordAction } from '@/action-menu/actions/record-actions/single-record/hooks/useDeleteSingleRecordAction';
import { useRemoveFromFavoritesSingleRecordAction } from '@/action-menu/actions/record-actions/single-record/hooks/useRemoveFromFavoritesSingleRecordAction';
import { SingleRecordActionKeys } from '@/action-menu/actions/record-actions/single-record/types/SingleRecordActionsKey';
import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import {
  ActionMenuEntry,
  ActionMenuEntryScope,
  ActionMenuEntryType,
} from '@/action-menu/types/ActionMenuEntry';
import { msg } from '@lingui/core/macro';
import {
  IconDatabaseExport,
  IconHeart,
  IconHeartOff,
  IconTrash,
  IconTrashX,
} from 'twenty-ui';

export const DEFAULT_ACTIONS_CONFIG_V1: Record<
  string,
  ActionMenuEntry & {
    useAction: ActionHook;
  }
> = {
  addToFavoritesSingleRecord: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: SingleRecordActionKeys.ADD_TO_FAVORITES,
    label: msg`Add to favorites`,
    position: 0,
    Icon: IconHeart,
    availableOn: [
      ActionViewType.SHOW_PAGE,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useAddToFavoritesSingleRecordAction,
  },
  removeFromFavoritesSingleRecord: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: SingleRecordActionKeys.REMOVE_FROM_FAVORITES,
    label: msg`Remove from favorites`,
    position: 1,
    Icon: IconHeartOff,
    availableOn: [
      ActionViewType.SHOW_PAGE,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useRemoveFromFavoritesSingleRecordAction,
  },
  deleteSingleRecord: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: SingleRecordActionKeys.DELETE,
    label: msg`Delete`,
    position: 2,
    Icon: IconTrash,
    accent: 'danger',
    isPinned: true,
    availableOn: [
      ActionViewType.SHOW_PAGE,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useDeleteSingleRecordAction,
  },
  deleteMultipleRecords: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.DELETE,
    label: msg`Delete records`,
    shortLabel: msg`Delete`,
    position: 3,
    Icon: IconTrash,
    accent: 'danger',
    isPinned: true,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useDeleteMultipleRecordsAction,
  },
  // duplicateMultipleRecords: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.DUPLICATE,
  //   label: msg`Duplicate multiple`,
  //   shortLabel: msg`Duplicate`,
  //   position: 5,
  //   Icon: IconTrash,
  //   accent: 'danger',
  //   isPinned: true,
  //   availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
  //   useAction: useDeleteMultipleRecordsAction,
  // },
  // createVideosForJobInterview: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.DUPLICATE,
  //   label: msg`Duplicate multiple`,
  //   shortLabel: msg`Duplicate`,
  //   position: 5,
  //   Icon: IconTrash,
  //   accent: 'danger',
  //   isPinned: true,
  //   availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
  //   useAction: useDeleteMultipleRecordsAction,
  // },
  destroyMultipleRecords: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.DESTROY,
    label: msg`Permanently destroy records`,
    shortLabel: msg`Destroy`,
    position: 11,
    Icon: IconTrashX,
    accent: 'danger',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useDestroyMultipleRecordsAction,
  },

  exportMultipleRecords: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.EXPORT,
    label: msg`Export records`,
    shortLabel: msg`Export`,
    position: 4,
    Icon: IconDatabaseExport,
    accent: 'default',
    isPinned: true,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useExportMultipleRecordsAction,
  },
  exportView: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.Object,
    key: NoSelectionRecordActionKeys.EXPORT_VIEW,
    label: msg`Export view`,
    shortLabel: msg`Export`,
    position: 5,
    Icon: IconDatabaseExport,
    accent: 'default',
    isPinned: true,
    availableOn: [ActionViewType.INDEX_PAGE_NO_SELECTION],
    useAction: useExportMultipleRecordsAction,
  },
};
