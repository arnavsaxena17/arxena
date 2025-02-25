import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import { ActionMenuEntry, ActionMenuEntryScope, ActionMenuEntryType, } from '@/action-menu/types/ActionMenuEntry';
import { msg } from '@lingui/core/macro';
import {
  IconCopy
} from 'twenty-ui';

import { useCloneMultipleRecordsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCloneMultipleRecordsAction';
import { useCreateMultipleVideoInterviewLinksAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useCreateMultipleVideoInterviewLinksAction';
import { useDeleteCandidatesAndPeopleAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useDeleteCandidatesAndPeopleAction';
import { usePopulateShortlistAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/usePopulateShortlistAction';
import { useRefreshChatCountsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useRefreshChatCountsAction';
import { useRefreshChatStatusesAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useRefreshChatStatusesAction';

import { useSendToWhatsappAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useSendToWhatsappAction';
import { useShareChatAndVideoInterviewBasedShortlistAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useShareChatAndVideoInterviewBasedShortlistAction';
import { useShareChatBasedShortlistAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useShareChatBasedShortlistAction';
import { useShareMultipleVideoInterviewLinksAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useShareMultipleVideoInterviewLinksAction';
import { useStartChatWithCandidatesAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useStartChatWithCandidatesAction';
import { IconList, IconMessageCircle, IconRefresh, IconShare, IconVideo } from '@tabler/icons-react';


export const CANDIDATE_SPECIFIC_ACTIONS: Record<
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
    position: 6,
    Icon: IconCopy,
    accent: 'danger',
    isPinned: true,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useCloneMultipleRecordsAction,
  },
  createVideoInterviewLink: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.VINT_LINK,
    label: msg`Create Video Interview Link`,
    shortLabel: msg`Create VINT Link`,
    position: 7,
    Icon: IconVideo,
    accent:'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useCreateMultipleVideoInterviewLinksAction,
  },
  shareMultipleVideoInterviewLinks: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.SHARE_VINT_LINK,
    label: msg`Share Video Interview Link`,
    shortLabel: msg`Share VINT Link`,
    position: 5,
    Icon: IconVideo,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useShareMultipleVideoInterviewLinksAction,
  },
  startChatWithCandidates: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.START_CHAT_WITH_CANDIDATES,
    label: msg`Start Chat with Candidates`,
    shortLabel: msg`Start Chat`,
    position: 5,
    Icon: IconMessageCircle,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useStartChatWithCandidatesAction,
  },
  refreshChatStatus: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.REFRESH_CHAT_STATUS,
    label: msg`Refresh Chat Status`,
    shortLabel: msg`Refresh Chat Status`,
    position: 5,
    Icon: IconRefresh,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useRefreshChatStatusesAction,
  },
  refreshChatCount: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.REFRESH_CHAT_COUNT,
    label: msg`Refresh Chat Count`,
    shortLabel: msg`Refresh Chat Counts`,
    position: 5,
    Icon: IconMessageCircle,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useRefreshChatCountsAction,
  },
  createShortlist: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.POPULATE_SHORTLIST,
    label: msg`Populate Shortlist Records`,
    shortLabel: msg`Populate Shortlist`,
    position: 5,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: usePopulateShortlistAction,
  },
  shareChatBasedShortlist: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CREATE_CHAT_BASED_SHORTLIST,
    label: msg`Share Chat Based Shortlist`,
    shortLabel: msg`Share Chat Shortlist`,
    position: 5,
    Icon: IconShare,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useShareChatBasedShortlistAction,
  },
  shareChatAndVideoInterviewBasedShortlist: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CHAT_AND_VIDEO_INTERVIEW_SHORTLIST,
    label: msg`Share VINT and Chat Based Shortlist`,
    shortLabel: msg`Share VINT and Chat Shortlist`,
    position: 5,
    Icon: IconShare,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useShareChatAndVideoInterviewBasedShortlistAction,
  },
  sendToWhatsapp: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.SEND_TO_WHATSAPP,
    label: msg`Send To Whatsapp Chrome Extension`,
    shortLabel: msg`Send to Whatsapp Chrome Extension`,
    position: 5,
    Icon: IconMessageCircle,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useSendToWhatsappAction,
  },
  deleteCandidatesAndPeople: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.DELETE_CANDIDATES_AND_PEOPLE,
    label: msg`Delete Candidates and People`,
    shortLabel: msg`Delete Candidates and People`,
    position: 5,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useDeleteCandidatesAndPeopleAction,
  },
};
