import { ActionHook } from '@/action-menu/actions/types/ActionHook';
import { ActionViewType } from '@/action-menu/actions/types/ActionViewType';
import {
    ActionMenuEntry,
    ActionMenuEntryScope,
    ActionMenuEntryType,
} from '@/action-menu/types/ActionMenuEntry';
import { useBulkMessageChatAction } from '@/activities/chats/hooks/useBulkMessageChatAction';
import { useViewAttachmentsChatAction } from '@/activities/chats/hooks/useViewAttachmentsChatAction';
import { ChatActionKeys } from '@/activities/chats/types/ChatActionKeys';
import { msg } from '@lingui/core/macro';
import {
    IconFileCheck,
    IconMessage,
    IconPaperclip,
    IconUser,
} from 'twenty-ui';

export const CHAT_ACTIONS_CONFIG: Record<
  string,
  ActionMenuEntry & {
    useAction: ActionHook;
  }
> = {
  bulkMessageChat: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: ChatActionKeys.BULK_MESSAGE,
    label: msg`Bulk message`,
    shortLabel: msg`Message`,
    position: 1,
    isPinned: true, // This makes it visible in the action menu bar
    Icon: IconMessage,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useBulkMessageChatAction,
  },
  viewAttachmentsChat: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: ChatActionKeys.VIEW_ATTACHMENTS,
    label: msg`View attachments`,
    shortLabel: msg`Attachments`,
    position: 2,
    isPinned: true, // This makes it visible in the action menu bar
    Icon: IconPaperclip,
    availableOn: [
      ActionViewType.INDEX_PAGE_SINGLE_RECORD_SELECTION,
      ActionViewType.SHOW_PAGE,
    ],
    useAction: useViewAttachmentsChatAction,
  },
  createShortlist: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: ChatActionKeys.CREATE_SHORTLIST,
    label: msg`Create shortlist`,
    shortLabel: msg`Shortlist`,
    position: 3,
    isPinned: true, // This makes it visible in the action menu bar
    Icon: IconFileCheck,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useBulkMessageChatAction, // This would typically point to a different action hook
  },
  updateStatus: {
    type: ActionMenuEntryType.Standard,
    scope: ActionMenuEntryScope.RecordSelection,
    key: ChatActionKeys.UPDATE_STATUS,
    label: msg`Update status`,
    shortLabel: msg`Status`,
    position: 4,
    isPinned: false, // This will NOT be visible in the action menu bar but will be in the dropdown
    Icon: IconUser,
    availableOn: [ActionViewType.INDEX_PAGE_BULK_SELECTION],
    useAction: useBulkMessageChatAction, // This would typically point to a different action hook
  },
}; 