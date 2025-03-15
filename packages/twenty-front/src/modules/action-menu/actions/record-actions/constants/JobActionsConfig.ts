import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import {
  ActionMenuEntry,
  ActionMenuEntryScope,
  ActionMenuEntryType,
} from '@/action-menu/types/ActionMenuEntry';
import { msg } from '@lingui/core/macro';
import { IconCopy, IconList } from 'twenty-ui';

import { useCheckDataIntegrityOfJobAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCheckDataIntegrityOfJobAction';
import { useCloneMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCloneMultipleRecordsAction';
import { useCreateInterviewVideosAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCreateInterviewVideosAction';

export const JOB_SPECIFIC_ACTIONS: Record<
  string,
  ActionMenuEntry & {
    useAction: ActionHook;
  }
> = {
  cloneMultipleRecords: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CLONE,
    label: msg`Clone multiple`,
    shortLabel: msg`Clone`,
    position: 1,
    Icon: IconCopy,
    accent: 'danger',
    isPinned: true,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useCloneMultipleRecordsAction,
  },
  createInterviewerAvatarVideos: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CREATE_INTERVIEWER_AVATAR_VIDEOS,
    label: msg`Create Interviewer Avatar Videos`,
    shortLabel: msg`Create Interviewer Avatar Videos`,
    position: 2,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: true,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useCreateInterviewVideosAction,
  },
  checkDataIntegrityOfJob: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CHECK_DATA_INTEGRITY_OF_JOB,
    label: msg`Check Data Integrity of Job`,
    shortLabel: msg`Check Data Integrity of Job`,
    position: 3,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: true,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
      ActionViewType.SHOW_PAGE,
    ],
    useAction: useCheckDataIntegrityOfJobAction,
  },
};
