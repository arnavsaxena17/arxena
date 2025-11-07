import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useSendCVsToClient } from '@/object-record/hooks/useSendCVsToClient';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import axios from 'axios';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useDownloadShortlistAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => {
  const { enqueueSnackBar } = useSnackBar();
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);
  const searchResults = useRecoilValue(searchResultsState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [isDownloadShortlistModalOpen, setIsDownloadShortlistModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { sendCVsToClient, loading, error } = useSendCVsToClient();
  const { findManyAttachments } = useFindManyAttachments();

  const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
    contextStoreNumberOfSelectedRecordsComponentState,
  );
  
  const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
    contextStoreTargetedRecordsRuleComponentState,
  );
    
  const contextStoreFilters = useRecoilComponentValueV2(
    contextStoreFiltersComponentState,
  );
    
  const { filterValueDependencies } = useFilterValueDependencies();
  const graphqlFilter = computeContextStoreFilters(
    contextStoreTargetedRecordsRule,
    contextStoreFilters,
    objectMetadataItem,
    filterValueDependencies,
  );
    
  const { fetchAllRecords: fetchAllRecordIds } = useLazyFetchAllRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    filter: graphqlFilter,
    limit: DEFAULT_QUERY_PAGE_SIZE,
    recordGqlFields: { id: true },
  });

  const isRemoteObject = objectMetadataItem.isRemote;
  const shouldBeRegistered =
    !isRemoteObject &&
    isDefined(contextStoreNumberOfSelectedRecords) &&
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0;

  const resetState = useCallback(() => {
    setIsDownloading(false);
  }, []);

  const cleanUrl = (url: string) => {
    const [baseWithFirstToken] = url.split('?token=');
    const firstToken = url.split('?token=')[1]?.split('?token=')[0];
    return firstToken ? `${baseWithFirstToken}?token=${firstToken}` : url;
  };

  const downloadAttachments = async (cvSentId: string) => {
    if (!cvSentId) {
      throw new Error('No CV sent ID provided');
    }

    try {
      const attachments = await findManyAttachments({
        filter: {
          cvSentId: {
            eq: cvSentId
          }
        },
        orderBy: [{
          createdAt: 'DescNullsFirst'
        }]
      });

      if (!attachments || attachments.length === 0) {
        throw new Error('No attachments found for shortlist');
      }

      const zip = new JSZip();
      let filesDownloaded = 0;

      for (const attachment of attachments) {
        if (!attachment.fullPath || !attachment.name) continue;
        
        try {
          const fileResponse = await axios({
            method: 'GET',
            url: cleanUrl(attachment.fullPath),
            responseType: 'blob'
          });
          zip.file(attachment.name, fileResponse.data);
          filesDownloaded++;
        } catch (err) {
          console.error(`Error downloading ${attachment.name}:`, err);
          enqueueSnackBar(`Error downloading ${attachment.name}`, {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
      }

      if (filesDownloaded === 0) {
        throw new Error('Failed to download any files');
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'shortlist_documents.zip');
      return filesDownloaded;
    } catch (err) {
      throw err;
    }
  };

  const handleDownloadShortlistClick = useCallback(async () => {
    if (isDownloading) {
      enqueueSnackBar('A download is already in progress', {
        variant: SnackBarVariant.Warning,
        duration: 3000,
      });
      return;
    }

    try {
      setIsDownloading(true);
      let recordsForShortlist;

      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        const selectedIdsSet = new Set(tableState.selectedRowIds);
        
        // Filter database candidates (from rawData) - match by id
        const databaseCandidates = tableState.rawData.filter(record => 
          selectedIdsSet.has(record.id)
        );
        
        // Filter LinkedIn/search candidates (from searchResults) - match by id first, then tempId
        // Since selectedRowIds now prefers permanent id, check id first
        const searchCandidates = searchResults.filter((record) => {
          const recordId = record?.id;
          const recordTempId = record?.tempId;
          // Check if selectedRowIds contains either the permanent id or tempId
          return (recordId && selectedIdsSet.has(recordId)) || 
                 (recordTempId && selectedIdsSet.has(recordTempId));
        });
        
        // Merge both types of candidates
        recordsForShortlist = [...databaseCandidates, ...searchCandidates];
      } else {
        recordsForShortlist = await fetchAllRecordIds();
      }

      if (!recordsForShortlist || recordsForShortlist.length === 0) {
        enqueueSnackBar('No records selected for shortlist', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      const recordIdsForShortlist = recordsForShortlist
        .map((record) => 
          (record as { tempId?: string; id: string | null }).tempId || record.id
        )
        .filter((id): id is string => id !== null && id !== undefined);
      const response = await sendCVsToClient(recordIdsForShortlist, 'create-gmail-draft-shortlist');
      
      if (!response?.results?.cv_sent_id) {
        throw new Error('Failed to create shortlist');
      }

      const filesDownloaded = await downloadAttachments(response.results.cv_sent_id);
      
      enqueueSnackBar(`Successfully downloaded ${filesDownloaded} shortlist document(s)`, {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });

      setIsDownloadShortlistModalOpen(false);
    } catch (error) {
      console.error('Error handling shortlist download:', error);
      enqueueSnackBar(error instanceof Error ? error.message : 'Error processing shortlist download', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  }, [
    isDownloading,
    isJobRoute,
    tableState,
    searchResults,
    fetchAllRecordIds,
    sendCVsToClient,
    downloadAttachments,
    enqueueSnackBar,
  ]);

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    resetState();
    setIsDownloadShortlistModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isDownloadShortlistModalOpen}
      setIsOpen={(isOpen) => {
        setIsDownloadShortlistModalOpen(isOpen);
        if (!isOpen) {
          resetState();
        }
      }}
      title="Download Shortlist"
      subtitle={`Are you sure you want to download the shortlist for ${contextStoreNumberOfSelectedRecords} selected record(s)?`}
      onConfirmClick={handleDownloadShortlistClick}
      deleteButtonText="Download Shortlist"
      confirmButtonAccent="blue"
      loading={isDownloading || loading}
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
    isLoading: isDownloading || loading,
  };
};