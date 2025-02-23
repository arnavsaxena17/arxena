import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import { ActionMenuEntry, ActionMenuEntryScope, ActionMenuEntryType, } from '@/action-menu/types/ActionMenuEntry';
import { msg } from '@lingui/core/macro';
import {
  IconCopy
} from 'twenty-ui';

import { useCloneMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCloneMultipleRecordsAction';

import { useShareMultipleVideoInterviewLinksAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useShareMultipleVideoInterviewLinksAction';
import { IconList } from '@tabler/icons-react';
import { graphQltoUpdateOneCandidate } from 'twenty-shared';

console.log("This is the qurey:", graphQltoUpdateOneCandidate); 

export const VIDEO_INTERVIEW_SPECIFIC_ACTIONS: Record<
  string,
  ActionMenuEntry & {
    useAction: ActionHook;
  }
> = {
  cloneMultipleRecords: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CLONE_VINT_INTERVIEW,
    label: msg`Clone multiple`,
    shortLabel: msg`Clone`,
    position: 6,
    Icon: IconCopy,
    accent: 'danger',
    isPinned: true,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useCloneMultipleRecordsAction,
  },
  useSendVideoInterviewLinks: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.SHARE_VINT_LINK,
    label: msg`Share Video Interview Link With Candidate`,
    shortLabel: msg`Share Video Interview Link with Candidate`,
    position: 5,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useShareMultipleVideoInterviewLinksAction,
  },
};
