import { useCallback, useEffect, useMemo, useState } from 'react';
import { isNonEmptyString } from '@sniptt/guards';
import { RecoilState, useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import {
  IconClick,
  IconFileExport,
  IconHeart,
  IconHeartOff,
  IconMail,
  IconPuzzle,
  IconTrash,
} from 'twenty-ui';

import { useCommandMenu } from "@/command-menu/hooks/useCommandMenu";


import { useFavorites } from '@/favorites/hooks/useFavorites';
import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { useDeleteManyRecords } from '@/object-record/hooks/useDeleteManyRecords';
import { useExecuteQuickActionOnOneRecord } from '@/object-record/hooks/useExecuteQuickActionOnOneRecord';
import { useCloneOneRecord } from '@/object-record/hooks/useCloneOneRecord'; // Import the new hook
import { useCreateInterviewVideos } from '@/object-record/hooks/useCreateInterviewVideos'; // Import the new hook
import { displayedExportProgress, useExportTableData, } from '@/object-record/record-index/options/hooks/useExportTableData';
import { useShowCV } from '@/object-record/record-index/options/hooks/useShowCV';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { actionBarEntriesState } from '@/ui/navigation/action-bar/states/actionBarEntriesState';
import { contextMenuEntriesState } from '@/ui/navigation/context-menu/states/contextMenuEntriesState';
import { ContextMenuEntry } from '@/ui/navigation/context-menu/types/ContextMenuEntry';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { isDefined } from '~/utils/isDefined';
import { IconBriefcase2, IconCactus, IconClipboard, IconCopy, IconMessage, IconMessage2, IconPaperclip, IconRefresh, IconRefreshDot, IconUserPlus, IconUsersPlus, IconVideo } from '@tabler/icons-react';
import { useCreateVideoInterview } from '@/object-record/hooks/useCreateInterview';
import { useRefreshChatStatus } from '@/object-record/hooks/useRefreshChatStatus';
import { useRefreshChatCounts } from '@/object-record/hooks/useRefreshChatCounts';
import { useExecuteDeleteCandidatesAndPeople } from '@/object-record/hooks/useExecuteDeleteCandidatesAndPeople';
import { tokenPairState } from '@/auth/states/tokenPairState';
import SlidingChatPanel from '@/activities/chats/components/SlidingChatPanel';
import { CurrentWorkspaceMember, currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';
import { chatPanelState } from '@/activities/chats/states/chatPanelState';
import { useOpenCreateActivityDrawer } from '@/activities/hooks/useOpenCreateActivityDrawer';


type useRecordActionBarProps = {
  objectMetadataItem: ObjectMetadataItem;
  selectedRecordIds: string[];
  callback?: () => void;
};


export const useRecordActionBar = ({
  objectMetadataItem,
  selectedRecordIds,
  callback,
}: useRecordActionBarProps) => {
  const setContextMenuEntries = useSetRecoilState(contextMenuEntriesState);
  const setActionBarEntriesState = useSetRecoilState(actionBarEntriesState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState) as WorkspaceMember | null;
  const [isDeleteRecordsModalOpen, setIsDeleteRecordsModalOpen] = useState(false);
  // const { toggleCommandMenu } = useCommandMenu();
  const openCreateActivity = useOpenCreateActivityDrawer();

  const { createFavorite, favorites, deleteFavorite } = useFavorites();

  const { deleteManyRecords } = useDeleteManyRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const { executeQuickActionOnOneRecord } = useExecuteQuickActionOnOneRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
  });

  const { cloneRecord, loading: isCloning, isReady } = useCloneOneRecord({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordIdToClone: selectedRecordIds[0], // We'll handle multiple records in handleClone
  });

  const { createVideosForJobs, loading: creatingVideos } = useCreateInterviewVideos({
    onSuccess: () => { console.log('Successfully created videos for all jobs'); },
    onError: (error) => { console.error('Failed to create videos:', error); },
  });

  const { createVideoInterviewLink, loading: creatingVideoInterview } = useCreateVideoInterview({
    onSuccess: () => { },
    onError: (error: any) => { console.error('Failed to create video interview:', error); },
  });
  
  const { refreshChatStatus } = useRefreshChatStatus({
    onSuccess: () => {},
    onError: (error: any) => { console.error('Failed to refresh chat status:', error); },
  });
  const { refreshChatCounts } = useRefreshChatCounts({
    onSuccess: () => { },
    onError: (error: any) => { console.error('Failed to refresh chat counts:', error); },
  });


  const { deleteCandidatesAndPeople, loading: executingDeleteCandidatesAndPeople } = useExecuteDeleteCandidatesAndPeople({
    objectNameSingular: objectMetadataItem.nameSingular,
    onSuccess: () => {
      // Additional success handling if needed
    },
    onError: (error: any) => {
      // Additional error handling if needed
      console.error('Failed to create video interview:', error);
    },
  });

  const handleClone = useCallback(async () => {
    callback?.();
    console.log("Going to try and clone:", selectedRecordIds);
    
    try {
      // Wait for hook to be ready
      if (!isReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Clone records sequentially
      for (const recordId of selectedRecordIds) {
        // Update the recordIdToClone through state updates
        const clonedRecord = await cloneRecord();
        
        if (clonedRecord) {
          console.log("Successfully cloned record:", clonedRecord);
        } else {
          console.log("Could not clone record - check if data is available");
        }
        
        // Add delay between clones
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error("Error cloning record:", error);
    }
  }, [callback, cloneRecord, isReady, selectedRecordIds]);

  const handleFavoriteButtonClick = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        if (selectedRecordIds.length > 1) {
          return;
        }

        const selectedRecordId = selectedRecordIds[0];
        const selectedRecord = snapshot
          .getLoadable(recordStoreFamilyState(selectedRecordId))
          .getValue();

        const foundFavorite = favorites?.find(
          (favorite) => favorite.recordId === selectedRecordId,
        );

        const isFavorite = !!selectedRecordId && !!foundFavorite;

        if (isFavorite) {
          deleteFavorite(foundFavorite.id);
        } else if (isDefined(selectedRecord)) {
          createFavorite(selectedRecord, objectMetadataItem.nameSingular);
        }
        callback?.();
      },
    [
      callback,
      createFavorite,
      deleteFavorite,
      favorites,
      objectMetadataItem.nameSingular,
      selectedRecordIds,
    ],
  );

  const handleDeleteClick = useCallback(async () => {
    callback?.();
    selectedRecordIds.forEach((recordId) => {
      const foundFavorite = favorites?.find(
        (favorite) => favorite.recordId === recordId,
      );
      if (foundFavorite !== undefined) {
        deleteFavorite(foundFavorite.id);
      }
    });
    await deleteManyRecords(selectedRecordIds);
  }, [
    callback,
    deleteManyRecords,
    selectedRecordIds,
    favorites,
    deleteFavorite,
  ]);

  const handleExecuteQuickActionOnClick = useCallback(async () => {
    callback?.();
    await Promise.all(
      selectedRecordIds.map(async (recordId) => {
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

  function callTargetObject() {
      openCreateActivity({
        type: 'Note',
        targetableObjects: [{ id: selectedRecordIds[0], targetObjectNameSingular: objectMetadataItem.nameSingular }],
    });
  }

  // const { progressCV, showCV } = useShowCV({
  //   objectNameSingular: objectMetadataItem.nameSingular,
  //   recordIndexId: objectMetadataItem.namePlural,

  // });

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
    [objectMetadataItem.nameSingular]
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
            title={`Delete ${selectedRecordIds.length} ${
              selectedRecordIds.length === 1 ? `record` : 'records'
            }`}
            subtitle={`This action cannot be undone. This will permanently delete ${
              selectedRecordIds.length === 1 ? 'this record' : 'these records'
            }`}
            onConfirmClick={() => handleDeleteClick()}
            deleteButtonText={`Delete ${
              selectedRecordIds.length > 1 ? 'Records' : 'Record'
            }`}
          />
        ),
      },
    ],
    [
      handleDeleteClick,
      selectedRecordIds,
      isDeleteRecordsModalOpen,
      setIsDeleteRecordsModalOpen,
    ],
  );

  // const dataExecuteQuickActionOnmentEnabled = useIsFeatureEnabled( 'IS_QUICK_ACTIONS_ENABLED');
  const dataExecuteQuickActionOnmentEnabled = true;


  const hasOnlyOneRecordSelected = selectedRecordIds.length === 1;

  const isFavorite =
    isNonEmptyString(selectedRecordIds[0]) &&
    !!favorites?.find((favorite) => favorite.recordId === selectedRecordIds[0]);

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
                  onClick: callTargetObject
                    
                },
                {
                  label: 'Show Chats',
                  Icon: IconMessage,
                  accent: 'default' as const,
                  onClick: callTargetObject
                    
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
    }, [
      baseActions,
      deletionActions,
      handleFavoriteButtonClick,
      hasOnlyOneRecordSelected,
      isFavorite,
      isRemoteObject,
      setContextMenuEntries,
    ]),
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
    }, [
      baseActions,
      dataExecuteQuickActionOnmentEnabled,
      deletionActions,
      handleExecuteQuickActionOnClick,
      handleClone,
      isCloning,
      isRemoteObject,
      setActionBarEntriesState,

    ]),
    
    };
};
