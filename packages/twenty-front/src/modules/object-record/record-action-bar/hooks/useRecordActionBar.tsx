import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { IconClick, IconFileExport, IconHeart, IconHeartOff, IconTrash } from 'twenty-ui';
import { selectedRecordsForModalState } from '../../states/selectedRecordsState';

import { chatPanelState } from '@/activities/chats/states/chatPanelState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { useFavorites } from '@/favorites/hooks/useFavorites';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { useCloneOneRecord } from '@/object-record/hooks/useCloneOneRecord'; // Import the new hook
import { useCreateVideoInterview } from '@/object-record/hooks/useCreateInterview';
import { useCreateInterviewVideos } from '@/object-record/hooks/useCreateInterviewVideos'; // Import the new hook
import { useDeleteManyRecords } from '@/object-record/hooks/useDeleteManyRecords';
import { useExecuteDeleteCandidatesAndPeople } from '@/object-record/hooks/useExecuteDeleteCandidatesAndPeople';
import { useExecuteQuickActionOnOneRecord } from '@/object-record/hooks/useExecuteQuickActionOnOneRecord';
import { useRefreshChatCounts } from '@/object-record/hooks/useRefreshChatCounts';
import { useRefreshChatStatus } from '@/object-record/hooks/useRefreshChatStatus';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useSendVideoInterview } from '@/object-record/hooks/useSendInterview';
import { useSendToWhatsapp } from '@/object-record/hooks/useSendToWhatsapp';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { displayedExportProgress, useExportTableData } from '@/object-record/record-index/options/hooks/useExportTableData';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { RightDrawerPages } from '@/ui/layout/right-drawer/types/RightDrawerPages';
import { actionBarEntriesState } from '@/ui/navigation/action-bar/states/actionBarEntriesState';
import { contextMenuEntriesState } from '@/ui/navigation/context-menu/states/contextMenuEntriesState';
import { ContextMenuEntry } from '@/ui/navigation/context-menu/types/ContextMenuEntry';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';
import { IconBrandWhatsapp, IconCopy, IconDashboard, IconDatabase, IconMessage, IconPaperclip, IconRefresh, IconRefreshDot, IconSend2, IconUsersPlus, IconVideo } from '@tabler/icons-react';
import { isDefined } from '~/utils/isDefined';
// import { useGetCurrentView } from '@/views/hooks/useGetCurrentView';
// import { useHandleViews } from '@/views/hooks/useHandleViews';
// import { ViewScope } from '@/views/scopes/ViewScope';
// import { useAvailableScopeIdOrThrow } from '@/ui/utilities/recoil-scope/scopes-internal/hooks/useAvailableScopeId';
// import { ViewScopeInternalContext } from '@/views/scopes/scope-internal-context/ViewScopeInternalContext';
import { useCheckDataIntegrityOfJob } from '@/object-record/hooks/useCheckDataIntegrityOfJob';
import { useCloneMultipleRecords } from '@/object-record/hooks/useCloneMultipleRecords';
import { useTranscribeCall } from '@/object-record/hooks/useTranscribeCall';
import { currentViewWithFiltersState } from '@/views/states/currentViewState';

type useRecordActionBarProps = {
  objectMetadataItem: ObjectMetadataItem;
  selectedRecordIds: string[];
  callback?: () => void;
};

export const useRecordActionBar = ({ objectMetadataItem, selectedRecordIds, callback }: useRecordActionBarProps) => {
  const setContextMenuEntries = useSetRecoilState(contextMenuEntriesState);
  const setActionBarEntriesState = useSetRecoilState(actionBarEntriesState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState) as WorkspaceMember | null;
  const [isDeleteRecordsModalOpen, setIsDeleteRecordsModalOpen] = useState(false);

  const { openRightDrawer } = useRightDrawer();
  const [_, setChatPanel] = useRecoilState(chatPanelState);

  const currentViewWithCombinedFiltersAndSorts = useRecoilValue(currentViewWithFiltersState);

  const setSelectedRecordsForModal = useSetRecoilState(selectedRecordsForModalState);
  useEffect(() => {
    setSelectedRecordsForModal(selectedRecordIds);
  }, [selectedRecordIds, setSelectedRecordsForModal]);

  const { createFavorite, favorites, deleteFavorite } = useFavorites();

  const { deleteManyRecords } = useDeleteManyRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const { executeQuickActionOnOneRecord } = useExecuteQuickActionOnOneRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const {
    cloneRecord,
    loading: isCloning,
    isReady,
  } = useCloneOneRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordIdToClone: selectedRecordIds[0], // We'll handle multiple records in handleClone
  });

  const { createVideosForJobs, loading: creatingVideos } = useCreateInterviewVideos({
    onSuccess: () => {
      console.log('Successfully created videos for all jobs');
    },
    onError: error => {
      console.error('Failed to create videos:', error);
    },
  });

  const { createVideoInterviewLink, loading: creatingVideoInterview } = useCreateVideoInterview({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to create video interview:', error);
    },
  });
  const { sendCreateVideoInterviewLink } = useSendVideoInterview({
    createVideoInterviewLink: true,
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to create video interview:', error);
    },
  });

  const { checkDataIntegrityOfJob } = useCheckDataIntegrityOfJob({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to check data integrity:', error);
    },
  });

  const { sendVideoInterviewLink } = useSendVideoInterview({
    createVideoInterviewLink: false,
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to send video interview:', error);
    },
  });
  const { sendStartChatRequest } = useStartChats({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to send start chat:', error);
    },
  });

  const { refreshChatStatus } = useRefreshChatStatus({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to refresh chat status:', error);
    },
  });
  const { transcribeCall } = useTranscribeCall({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to transcribe call:', error);
    },
  });

  const { refreshChatCounts } = useRefreshChatCounts({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to refresh chat counts:', error);
    },
  });
  const { sendCVsToClient } = useSendCVsToClient({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to useSendCVsToClient:', error);
    },
  });
  const { sendToWhatsapp } = useSendToWhatsapp({
    onSuccess: () => {},
    onError: (error: any) => {
      console.error('Failed to useSendToWhatsapp:', error);
    },
  });

  const { deleteCandidatesAndPeople } = useExecuteDeleteCandidatesAndPeople({
    objectNameSingular: objectMetadataItem.nameSingular,
    onSuccess: () => {
      // Additional success handling if needed
    },
    onError: (error: any) => {
      // Additional error handling if needed
      console.error('Failed to create video interview:', error);
    },
  });
  console.log('These are the selectred IDz:', selectedRecordIds);

  // Then in useRecordActionBar:
  const { cloneMultipleRecords } = useCloneMultipleRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const handleClone = useCallback(async () => {
    callback?.();
    console.log('Going to try and clone:', selectedRecordIds);

    try {
      const clonedRecords = await cloneMultipleRecords(selectedRecordIds);
      console.log('Successfully cloned records:', clonedRecords);
    } catch (error) {
      console.error('Error cloning records:', error);
    }
  }, [callback, cloneMultipleRecords, selectedRecordIds]);

  const sendVideoInterviewLinkSelectRecord = useRecoilCallback(
    ({ snapshot }) =>
      async (selectedRecordIds: string[]) => {
        const selectedRecordId = selectedRecordIds[0];
        const selectedRecord = snapshot.getLoadable(recordStoreFamilyState(selectedRecordId)).getValue();
        console.log('selected record', selectedRecord);
        const candidateId = selectedRecord?.candidate?.id;
        sendVideoInterviewLink([candidateId]);
      },
    [sendVideoInterviewLink],
  );

  const handleFavoriteButtonClick = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        if (selectedRecordIds.length > 1) {
          return;
        }

        const selectedRecordId = selectedRecordIds[0];
        const selectedRecord = snapshot.getLoadable(recordStoreFamilyState(selectedRecordId)).getValue();

        const foundFavorite = favorites?.find(favorite => favorite.recordId === selectedRecordId);

        const isFavorite = !!selectedRecordId && !!foundFavorite;

        if (isFavorite) {
          deleteFavorite(foundFavorite.id);
        } else if (isDefined(selectedRecord)) {
          createFavorite(selectedRecord, objectMetadataItem.nameSingular);
        }
        callback?.();
      },
    [callback, createFavorite, deleteFavorite, favorites, objectMetadataItem.nameSingular, selectedRecordIds],
  );

  const handleDeleteClick = useCallback(async () => {
    callback?.();
    selectedRecordIds.forEach(recordId => {
      const foundFavorite = favorites?.find(favorite => favorite.recordId === recordId);
      if (foundFavorite !== undefined) {
        deleteFavorite(foundFavorite.id);
      }
    });
    await deleteManyRecords(selectedRecordIds);
  }, [callback, deleteManyRecords, selectedRecordIds, favorites, deleteFavorite]);

  const handleExecuteQuickActionOnClick = useCallback(async () => {
    callback?.();
    await Promise.all(
      selectedRecordIds.map(async recordId => {
        await executeQuickActionOnOneRecord(recordId);
      }),
    );
  }, [callback, executeQuickActionOnOneRecord, selectedRecordIds]);

  const { progress, download } = useExportTableData({
    delayMs: 100,
    filename: `${objectMetadataItem.nameSingular}.csv`,
    objectNameSingular: objectMetadataItem.nameSingular,
    recordIndexId: objectMetadataItem.namePlural,
  });

  function callViewChatRightDrawer() {
    console.log('View Chat Right Drawer for:', selectedRecordIds);
    setChatPanel({
      selectedRecordIds: selectedRecordIds,
    });

    openRightDrawer(RightDrawerPages.ViewChat);
  }

  function callViewCVRightDrawer() {
    console.log('View Right CV Drawer');
    openRightDrawer(RightDrawerPages.ViewCV);
  }

  const isRemoteObject = objectMetadataItem.isRemote;

  const baseActions: ContextMenuEntry[] = useMemo(
    () => [
      {
        label: displayedExportProgress(progress),
        Icon: IconFileExport,
        accent: 'default' as const,
        onClick: () => download(),
      },
    ],
    [objectMetadataItem.nameSingular],
  );

  const deletionActions: ContextMenuEntry[] = useMemo(
    () => [
      {
        label: 'Delete',
        Icon: IconTrash,
        accent: 'danger' as const,
        onClick: () => setIsDeleteRecordsModalOpen(true),
        ConfirmationModal: (
          <ConfirmationModal
            isOpen={isDeleteRecordsModalOpen}
            setIsOpen={setIsDeleteRecordsModalOpen}
            title={`Delete ${selectedRecordIds.length} ${selectedRecordIds.length === 1 ? `record` : 'records'}`}
            subtitle={`This action cannot be undone. This will permanently delete ${selectedRecordIds.length === 1 ? 'this record' : 'these records'}`}
            onConfirmClick={() => handleDeleteClick()}
            deleteButtonText={`Delete ${selectedRecordIds.length > 1 ? 'Records' : 'Record'}`}
          />
        ),
      },
    ],
    [handleDeleteClick, selectedRecordIds, isDeleteRecordsModalOpen, setIsDeleteRecordsModalOpen],
  );

  // const dataExecuteQuickActionOnmentEnabled = useIsFeatureEnabled( 'IS_QUICK_ACTIONS_ENABLED');
  const dataExecuteQuickActionOnmentEnabled = true;

  const hasOnlyOneRecordSelected = selectedRecordIds.length === 1;

  const isFavorite = isNonEmptyString(selectedRecordIds[0]) && !!favorites?.find(favorite => favorite.recordId === selectedRecordIds[0]);

  return {
    setContextMenuEntries: useCallback(() => {
      setContextMenuEntries([
        ...(isRemoteObject ? [] : deletionActions),
        ...baseActions,
        ...(!isRemoteObject && isFavorite && hasOnlyOneRecordSelected
          ? [
              {
                label: 'Remove from favorites',
                Icon: IconHeartOff,
                onClick: handleFavoriteButtonClick,
              },
            ]
          : []),

        ...(objectMetadataItem.nameSingular === 'candidate'
          ? [
              {
                label: 'Show CV',
                Icon: IconPaperclip,
                accent: 'default' as const,
                onClick: callViewCVRightDrawer,
              },
              {
                label: 'Show Chats',
                Icon: IconMessage,
                accent: 'default' as const,
                onClick: callViewChatRightDrawer,
              },
            ]
          : []),

        ...(!isRemoteObject && !isFavorite && hasOnlyOneRecordSelected
          ? [
              {
                label: 'Add to favorites',
                Icon: IconHeart,
                onClick: handleFavoriteButtonClick,
              },
            ]
          : []),
      ]);
    }, [baseActions, deletionActions, handleFavoriteButtonClick, hasOnlyOneRecordSelected, isFavorite, isRemoteObject, setContextMenuEntries]),
    setActionBarEntries: useCallback(() => {
      setActionBarEntriesState([
        ...(isRemoteObject ? [] : deletionActions),
        ...(dataExecuteQuickActionOnmentEnabled
          ? [
              {
                label: 'Actions',
                Icon: IconClick,
                subActions: [
                  // {
                  //   label: 'Enrich',
                  //   Icon: IconPuzzle,
                  //   onClick: handleExecuteQuickActionOnClick,
                  // },
                  {
                    label: 'Clone Current Records',
                    Icon: IconCopy,
                    onClick: handleClone,
                  },
                  // {
                  //   label: 'Send to mailjet',
                  //   Icon: IconMail,
                  // },
                  ...(objectMetadataItem.nameSingular === 'job'
                    ? [
                        {
                          label: 'Create Videos from E2I',
                          Icon: IconVideo,
                          onClick: async () => {
                            try {
                              await createVideosForJobs(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Check Data Integrity ',
                          Icon: IconDashboard,
                          onClick: async () => {
                            try {
                              await checkDataIntegrityOfJob(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                      ]
                    : []),
                  ...(objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
                    ? [
                        {
                          label: 'Start Chat with Candidates',
                          Icon: IconBrandWhatsapp,
                          onClick: async () => {
                            try {
                              console.log('Current FcurrentViewWithCombinedFiltersAndSorts:', currentViewWithCombinedFiltersAndSorts);
                              console.log('Current selectedRecordIds:', selectedRecordIds);
                              await sendStartChatRequest(selectedRecordIds, currentViewWithCombinedFiltersAndSorts, objectMetadataItem.nameSingular);
                            } catch (error) {
                              console.error('Error creating start chat:', error);
                            }
                          },
                        },
                      ]
                    : []),
                  ...(objectMetadataItem.nameSingular.toLowerCase().includes('candidate')
                    ? [
                        {
                          label: 'Start Chat with Candidates',
                          Icon: IconBrandWhatsapp,
                          onClick: async () => {
                            try {
                              console.log('Current FcurrentViewWithCombinedFiltersAndSorts:', currentViewWithCombinedFiltersAndSorts);
                              console.log('Current selectedRecordIds:', selectedRecordIds);
                              await sendStartChatRequest(selectedRecordIds, currentViewWithCombinedFiltersAndSorts, objectMetadataItem.nameSingular);
                            } catch (error) {
                              console.error('Error creating start chat:', error);
                            }
                          },
                        },
                      ]
                    : []),
                  ...(objectMetadataItem.nameSingular === 'videoInterview'
                    ? [
                        {
                          label: 'Send Video Interview ',
                          Icon: IconVideo,
                          onClick: async () => {
                            try {
                              await sendVideoInterviewLinkSelectRecord(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                      ]
                    : []),
                  ...(objectMetadataItem.nameSingular === 'phoneCall'
                    ? [
                        {
                          label: 'Transcribe Call ',
                          Icon: IconVideo,
                          onClick: async () => {
                            try {
                              await transcribeCall(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                      ]
                    : []),

                  ...(objectMetadataItem.nameSingular === 'candidate'
                    ? [
                        {
                          label: 'Create Video Interview Link',
                          Icon: IconVideo,
                          onClick: async () => {
                            try {
                              await createVideoInterviewLink(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Create & Send Video Interview',
                          Icon: IconVideo,
                          onClick: async () => {
                            try {
                              await sendCreateVideoInterviewLink(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Refresh Chat Status',
                          Icon: IconRefreshDot,
                          onClick: async () => {
                            try {
                              if (currentWorkspaceMember) {
                                await refreshChatStatus(selectedRecordIds, currentWorkspaceMember);
                              } else {
                                console.error('Workspace member is null');
                              }
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Refresh Chat Counts',
                          Icon: IconRefresh,
                          onClick: async () => {
                            try {
                              await refreshChatCounts(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Create Shortlist',
                          Icon: IconDatabase,
                          onClick: async () => {
                            try {
                              await sendCVsToClient(selectedRecordIds, 'create-shortlist');
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Create Chat Based Shortlist',
                          Icon: IconDatabase,
                          onClick: async () => {
                            try {
                              await sendCVsToClient(selectedRecordIds, 'chat-based-shortlist-delivery');
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        // {
                        //   label: 'Create Shortlist Document',
                        //   Icon: IconSend2,
                        //   onClick: async () => {
                        //     try {
                        //       await sendCVsToClient(selectedRecordIds, 'create-shortlist-document');
                        //     } catch (error) {
                        //       console.error('Error creating videos:', error);
                        //     }
                        //   },
                        // },
                        {
                          label: 'Send Shortlist To Client',
                          Icon: IconSend2,
                          onClick: async () => {
                            try {
                              await sendCVsToClient(selectedRecordIds, 'create-gmail-draft-shortlist');
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Send To Whatsapp',
                          Icon: IconBrandWhatsapp,
                          onClick: async () => {
                            try {
                              await sendToWhatsapp(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                        {
                          label: 'Delete Candidates & People',
                          Icon: IconUsersPlus,
                          onClick: async () => {
                            try {
                              await deleteCandidatesAndPeople(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                      ]
                    : []),

                  ...(objectMetadataItem.nameSingular === 'person'
                    ? [
                        {
                          label: 'Delete People & Candidates',
                          Icon: IconUsersPlus,
                          onClick: async () => {
                            try {
                              await deleteCandidatesAndPeople(selectedRecordIds);
                            } catch (error) {
                              console.error('Error creating videos:', error);
                            }
                          },
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
        ...baseActions,
      ]);
    }, [baseActions, dataExecuteQuickActionOnmentEnabled, deletionActions, handleExecuteQuickActionOnClick, handleClone, isCloning, isRemoteObject, setActionBarEntriesState]),
  };
};
