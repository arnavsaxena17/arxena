import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';

export const useAddToGoogleContactsAction: ActionHookWithObjectMetadataItem =
  ({ objectMetadataItem }) => {
    const location = useLocation();
    const isJobRoute = location.pathname.includes('/job/');
    const tableState = useRecoilValue(tableStateAtom);
    const { enqueueSnackBar } = useSnackBar();
    const [tokenPair] = useRecoilState(tokenPairState);

    const contextStoreNumberOfSelectedRecords = useRecoilComponentValueV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const setNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
    );

    const contextStoreTargetedRecordsRule = useRecoilComponentValueV2(
      contextStoreTargetedRecordsRuleComponentState,
    );

    const setTargetedRecordsRule = useSetRecoilComponentStateV2(
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
    });

    const shouldBeRegistered = true;
    const [isAddToGoogleContactsModalOpen, setIsAddToGoogleContactsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const resetState = useCallback(() => {
      setIsProcessing(false);
      setNumberOfSelectedRecords(0);
      setTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: [],
      });
    }, [setNumberOfSelectedRecords, setTargetedRecordsRule]);

    const sendAddToGoogleContactsRequest = useCallback(async (candidateIds: string[], objectNameSingular: string) => {
      setLoading(true);
      
      try {
        const url = `${process.env.REACT_APP_SERVER_BASE_URL}/contacts/add-candidate-to-google-contacts`;
        
        const response = await axios.post(
          url,
          { 
            candidateIds: candidateIds,
            objectNameSingular: objectNameSingular
          },
          { 
            headers: { 
              Authorization: `Bearer ${tokenPair?.accessToken?.token}`, 
              'Content-Type': 'application/json' 
            } 
          }
        );
        
        return response.data;
      } catch (error) {
        console.error('Error adding candidates to Google Contacts:', error);
        throw error;
      } finally {
        setLoading(false);
      }
    }, [tokenPair?.accessToken?.token]);

    const validateAndGetRecords = useCallback(async () => {
      let recordsToAddToGoogleContacts;

      if (isJobRoute && tableState?.selectedRowIds?.length > 0) {
        recordsToAddToGoogleContacts = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        recordsToAddToGoogleContacts = await fetchAllRecordIds();
      }

      if (!recordsToAddToGoogleContacts || recordsToAddToGoogleContacts.length === 0) {
        throw new Error('No candidates selected to add to Google Contacts');
      }

      const recordIdsToAddToGoogleContacts = objectMetadataItem.nameSingular.toLowerCase()
        ? recordsToAddToGoogleContacts.map((record) => record.id)
        : recordsToAddToGoogleContacts.map((record) => (record as any).candidateId || record.id);

      return { recordIdsToAddToGoogleContacts };
    }, [isJobRoute, tableState, fetchAllRecordIds, objectMetadataItem.nameSingular]);

    const handleAddToGoogleContactsClick = useCallback(async () => {
      if (isProcessing) {
        enqueueSnackBar('Adding candidates to Google Contacts is already in progress', {
          variant: SnackBarVariant.Warning,
          duration: 3000,
        });
        return;
      }

      try {
        setIsProcessing(true);
        const { recordIdsToAddToGoogleContacts } = await validateAndGetRecords();
        
        const result = await sendAddToGoogleContactsRequest(
          recordIdsToAddToGoogleContacts,
          objectMetadataItem.nameSingular
        );

        enqueueSnackBar(`Successfully added ${result.created || 0} candidates to Google Contacts. ${result.skipped || 0} candidates were already in contacts.`, {
          variant: SnackBarVariant.Success,
          duration: 5000,
        });
        
        setIsAddToGoogleContactsModalOpen(false);
        resetState();
      } catch (error) {
        console.error('Error adding candidates to Google Contacts:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Error adding candidates to Google Contacts', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [
      isProcessing,
      validateAndGetRecords,
      sendAddToGoogleContactsRequest,
      objectMetadataItem.nameSingular,
      enqueueSnackBar,
      resetState
    ]);

    const onClick = useCallback(async () => {
      if (!shouldBeRegistered) {
        return;
      }

      if (isProcessing) {
        return;
      }
      
      try {
        setIsProcessing(true);
        await validateAndGetRecords();
        setIsAddToGoogleContactsModalOpen(true);
      } catch (error) {
        console.error('Error validating candidates:', error);
        enqueueSnackBar(error instanceof Error ? error.message : 'Error validating candidates', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
      } finally {
        setIsProcessing(false);
      }
    }, [shouldBeRegistered, isProcessing, validateAndGetRecords, enqueueSnackBar]);

    const confirmationModal = (
      <ConfirmationModal
        isOpen={isAddToGoogleContactsModalOpen}
        setIsOpen={(isOpen) => {
          setIsAddToGoogleContactsModalOpen(isOpen);
          if (!isOpen) {
            resetState();
          }
        }}
        title={'Add to Google Contacts'}
        subtitle={`Are you sure you want to add ${contextStoreNumberOfSelectedRecords} selected candidate(s) to Google Contacts?`}
        onConfirmClick={handleAddToGoogleContactsClick}
        deleteButtonText={'Add to Google Contacts'}
        confirmButtonAccent="blue"
        loading={isProcessing || loading}
      />
    );

    return {
      shouldBeRegistered,
      onClick,
      ConfirmationModal: confirmationModal,
      isLoading: isProcessing || loading,
    };
  };
