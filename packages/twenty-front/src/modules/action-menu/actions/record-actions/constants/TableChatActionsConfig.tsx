import { useAddToGoogleContactsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useAddToGoogleContactsAction';
import { useDeleteCandidatesAndPeopleAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useDeleteCandidatesAndPeopleAction';
import { useDownloadAsExcelAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useDownloadAsExcelAction';
import { useDownloadCandidateCVsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useDownloadCandidateCVsAction';
import { useResetMessagesFromWhatsappAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useResetMessagesFromWhatsappAction';
import { useRestartMessagesAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useRestartMessagesAction';
import { useSendToWhatsappAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useSendToWhatsappAction';
import { useShareChatAndVideoInterviewBasedShortlistAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useShareChatAndVideoInterviewBasedShortlistAction';
import { useStartChatWithCandidatesAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useStartChatWithCandidatesAction';
import { useSyncChatsWithWhatsappAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useSyncChatsWithWhatsappAction';
import { useUpdateSnapshotProfilesFromJobBoardsAction } from '@/action-menu/actions/record-actions/multiple-records/hooks/useUpdateSnapshotProfilesFromJobBoardsAction';
import { MultipleRecordsActionKeys } from '@/action-menu/actions/record-actions/multiple-records/types/MultipleRecordsActionKeys';
import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import {
  ActionMenuEntry,
  ActionMenuEntryScope,
  ActionMenuEntryType,
} from '@/action-menu/types/ActionMenuEntry';
import { msg } from '@lingui/core/macro';
import { IconDownload, IconMessageCircle, IconRefresh, IconShare, IconTrashOff, IconTrashX } from '@tabler/icons-react';
import {
  IconList
} from 'twenty-ui';

export const TABLE_CHAT_ACTIONS_CONFIG: Record<
  string,
  ActionMenuEntry & {
    useAction: ActionHook;
  }
> = {
  // bulkMessageChat: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: ChatActionKeys.BULK_MESSAGE,
  //   label: msg`Bulk message`,
  //   shortLabel: msg`Message`,
  //   position: 1,
  //   isPinned: true, // This makes it visible in the action menu bar
  //   Icon: IconMessage,
  //   availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
  //   useAction: useBulkMessageChatAction,
  // },
  // viewAttachmentsChat: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: ChatActionKeys.VIEW_ATTACHMENTS,
  //   label: msg`View attachments`,
  //   shortLabel: msg`Attachments`,
  //   position: 0,
  //   isPinned: true, // This makes it visible in the action menu bar
  //   Icon: IconPaperclip,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //     ActionViewType.SHOW_PAGE,
  //   ],
  //   useAction: useViewAttachmentsChatAction,
  // },
  // createShortlist: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: ChatActionKeys.CREATE_SHORTLIST,
  //   label: msg`Create shortlist`,
  //   shortLabel: msg`Shortlist`,
  //   position: 3,
  //   isPinned: true, // This makes it visible in the action menu bar
  //   Icon: IconFileCheck,
  //   availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
  //   useAction: useBulkMessageChatAction, // This would typically point to a different action hook
  // },
  // populateShortlist: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.POPULATE_SHORTLIST,
  //   label: msg`Populate Shortlist Records`,
  //   shortLabel: msg`Populate Shortlist`,
  //   position: 0,
  //   Icon: IconList,
  //   isPinned: true,
  //   accent: 'placeholder',
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: usePopulateShortlistAction,
  // },
  // updateStatus: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: ChatActionKeys.UPDATE_STATUS,
  //   label: msg`Update status`,
  //   shortLabel: msg`Status`,
  //   position: 1,
  //   isPinned: false, // This will NOT be visible in the action menu bar but will be in the dropdown
  //   Icon: IconUser,
  //   availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
  //   useAction: useBulkMessageChatAction, // This would typically point to a different action hook
  // },


  // cloneMultipleRecords: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.CLONE,
  //   label: msg`Clone multiple`,
  //   shortLabel: msg`Clone`,
  //   position: 1,
  //   Icon: IconCopy,
  //   accent: 'danger',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: useCloneMultipleRecordsAction,
  // },

  // createVideoInterviewLink: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.VINT_LINK,
  //   label: msg`Create Video Interview Link`,
  //   shortLabel: msg`Create VINT Link`,
  //   position: 2,
  //   Icon: IconVideo,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: useCreateMultipleVideoInterviewLinksAction,
  // },
  // shareMultipleVideoInterviewLinks: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.SHARE_VINT_LINK,
  //   label: msg`Share Video Interview Link`,
  //   shortLabel: msg`Share VINT Link`,
  //   position: 3,
  //   Icon: IconVideo,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: useShareMultipleVideoInterviewLinksAction,
  // },

  shareChatAndVideoInterviewBasedShortlist: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.CHAT_AND_VIDEO_INTERVIEW_SHORTLIST,
    label: msg`Create Shortlist PDF and Excel`,
    shortLabel: msg`Create Shortlist PDF and Excel`,
    position: 4,
    Icon: IconShare,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useShareChatAndVideoInterviewBasedShortlistAction,
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
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useStartChatWithCandidatesAction,
  },

  downloadCandidateCVs: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.DOWNLOAD_CANDIDATE_CVS,
    label: msg`Download Candidate CVs`,
    shortLabel: msg`Download CVs`,
    position: 6,
    Icon: IconDownload, // Use a download icon for "Download Candidate CVs"
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useDownloadCandidateCVsAction,
  },
  addToGoogleContacts: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.ADD_TO_GOOGLE_CONTACTS,
    label: msg`Add to Google Contacts`,
    shortLabel: msg`Add to Google Contacts`,
    position: 7,
    Icon: IconDownload,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useAddToGoogleContactsAction,
  },

  // refreshChatStatus: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.REFRESH_CHAT_STATUS,
  //   label: msg`Refresh Chat Status`,
  //   shortLabel: msg`Refresh Chat Status`,
  //   position: 7,
  //   Icon: IconRefresh,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: useRefreshChatStatusesAction,
  // },
  // refreshChatCount: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.REFRESH_CHAT_COUNT,
  //   label: msg`Refresh Chat Count`,
  //   shortLabel: msg`Refresh Chat Counts`,
  //   position: 7,
  //   Icon: IconMessageCircle,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //     ActionViewType.SHOW_PAGE,
  //   ],
  //   useAction: useRefreshChatCountsAction,
  // },

  // shareChatBasedShortlist: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.CREATE_CHAT_BASED_SHORTLIST,
  //   label: msg`Share Chat Based Shortlist`,
  //   shortLabel: msg`Share Chat Shortlist`,
  //   position: 8,
  //   Icon: IconShare,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //     ActionViewType.SHOW_PAGE,
  //   ],
  //   useAction: useShareChatBasedShortlistAction,
  // },

  updateProfiles: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.UPDATE_SNAPSHOT_PROFILES_FROM_JOB_BOARDS,
    shortLabel: msg`Save Resumes & Contacts from Portals`,
    label: msg`Save Resumes & Contacts from Portals`,
    position: 9,
    Icon: IconList,
    accent: 'danger',
    isPinned: true,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
      ActionViewType.SHOW_PAGE,
    ],
    useAction: useUpdateSnapshotProfilesFromJobBoardsAction,
  },

  restartMessages: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.RESTART_MSGS,
    shortLabel: msg`Reminder (remind) Messaging with Candidate`,
    label: msg`Reminder (remind) Messaging with Candidate`,
    position: 9,
    Icon: IconMessageCircle, // Changed from IconList to IconMessageCircle for better UX
    accent: 'placeholder',
    isPinned: true, // Changed to true to make it more accessible
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
      ActionViewType.SHOW_PAGE, // Added show page support
    ],
    useAction: useRestartMessagesAction,
  },

  resetMessagesFromWhatsapp: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.RESET_MSGS_FROM_WHATSAPP,
    shortLabel: msg`Delete Messages in Whatsapp`,
    label: msg`Delete Messages in Whatsapp`,
    position: 9,
    Icon: IconTrashX,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useResetMessagesFromWhatsappAction,
  },

  syncChatsWithWhatsapp: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.SYNC_CHATS_WITH_WHATSAPP,
    shortLabel: msg`Sync Chats with WhatsApp`,
    label: msg`Sync Chats with WhatsApp`,
    position: 10,
    Icon: IconRefresh,
    accent: 'placeholder',
    isPinned: true,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
      ActionViewType.SHOW_PAGE,
    ],
    useAction: useSyncChatsWithWhatsappAction,
  },

  // downloadShortlist: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.CHAT_AND_VIDEO_INTERVIEW_SHORTLIST,
  //   label: msg`Download Shortlist`,
  //   shortLabel: msg`Download Shortlist`,
  //   position: 9,
  //   Icon: IconShare,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: useDownloadShortlistAction,
  // },
  
  sendToWhatsapp: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.SEND_TO_WHATSAPP,
    label: msg`Send To Whatsapp Chrome Extension`,
    shortLabel: msg`Send to Whatsapp Chrome Extension`,
    position: 10,
    Icon: IconMessageCircle,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useSendToWhatsappAction,
  },

  deleteCandidatesAndPeople: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.DELETE_CANDIDATES_AND_PEOPLE,
    label: msg`Delete Candidates`,
    shortLabel: msg`Delete Candidates and People`,
    position: 9,
    Icon: IconTrashOff,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useDeleteCandidatesAndPeopleAction,
  },

  downloadAsExcel: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: MultipleRecordsActionKeys.DOWNLOAD_AS_EXCEL,
    label: msg`Download selected as Excel`,
    shortLabel: msg`Download selected as Excel`,
    position: 9,
    Icon: IconList,
    accent: 'placeholder',
    isPinned: false,
    availableOn: [
      ActionViewType.INDEX_PAGE_BULK_SELECTION,
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
    ],
    useAction: useDownloadAsExcelAction,
  },

  // enrichCandidates: {
  //   type: ActionMenuEntryType.Standard,
  //   scope: ActionMenuEntryScope.RecordSelection,
  //   key: MultipleRecordsActionKeys.ENRICH_CANDIDATES,
  //   shortLabel: msg`Enrich Candidates`,
  //   label: msg`Enrich Candidates`,
  //   position: 10,
  //   Icon: IconEngine,
  //   accent: 'placeholder',
  //   isPinned: false,
  //   availableOn: [
  //     ActionViewType.INDEX_PAGE_BULK_SELECTION,
  //     ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
  //   ],
  //   useAction: useCandidateEnrichmentAction,
  // },

}; 