import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import { ActionMenuEntry, ActionMenuEntryScope, ActionMenuEntryType, } from '@/action-menu/types/ActionMenuEntry';
import { msg } from '@lingui/core/macro';
import {
  IconCopy
} from 'twenty-ui';

import { useCloneMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCloneMultipleRecordsAction';

import { useCandidateEnrichmentAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCandidateEnrichmentAction';
import { useStartChatWithCandidatesAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useStartChatWithCandidatesAction';
import { IconEngine, IconList } from '@tabler/icons-react';


export const JOB_CANDIDATE_SPECIFIC_ACTIONS: Record<
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
    position: 4,
    Icon: IconCopy,
    accent: 'danger',
    isPinned: true,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION,ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION],
    useAction: useCloneMultipleRecordsAction,
  },
    startChatWWithCandidates: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.START_CHAT_WITH_CANDIDATES,
    shortLabel: msg`Start Chat with Candidates`,
    label: msg`Start Chat with Candidates`,
    position: 5,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION,ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION  ],
    useAction: useStartChatWithCandidatesAction,
  },
    enrichCandidates: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.ENRICH_CANDIDATES,
    shortLabel: msg`Enrich Candidates`,
    label: msg`Enrich Candidates`,
    position:7,
    Icon: IconEngine,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION,ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION  ],
    useAction: useCandidateEnrichmentAction,
  },
};
