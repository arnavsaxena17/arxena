import { ActionHookWithObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { tableStateAtom } from '@/candidate-table/states/states';
import { contextStoreFiltersComponentState } from '@/context-store/states/contextStoreFiltersComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { computeContextStoreFilters } from '@/context-store/utils/computeContextStoreFilters';
import { BACKEND_BATCH_REQUEST_MAX_COUNT } from '@/object-record/constants/BackendBatchRequestMaxCount';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { useFilterValueDependencies } from '@/object-record/record-filter/hooks/useFilterValueDependencies';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useSendToWhatsappAction: ActionHookWithObjectMetadataItem = ({ objectMetadataItem }) => { 
  const location = useLocation();
  const isJobRoute = location.pathname.includes('/job/');
  const tableState = useRecoilValue(tableStateAtom);
  
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
    
  const { fetchAllRecords } = useLazyFetchAllRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    filter: graphqlFilter,
    limit: DEFAULT_QUERY_PAGE_SIZE,
  });

  const isRemoteObject = objectMetadataItem.isRemote;
  const shouldBeRegistered =
    !isRemoteObject &&
    isDefined(contextStoreNumberOfSelectedRecords) &&
    contextStoreNumberOfSelectedRecords < BACKEND_BATCH_REQUEST_MAX_COUNT &&
    contextStoreNumberOfSelectedRecords > 0;
    
  const [isWhatsappMessageModalOpen, setIsWhatsappMessageModalOpen] = useState(false);

  const handleSendToWhatsappClick = useCallback(async () => {
    try {
      let selectedRecords;

      if (isJobRoute && tableState) {
        selectedRecords = tableState.rawData.filter(record => 
          tableState.selectedRowIds.includes(record.id)
        );
      } else {
        selectedRecords = await fetchAllRecords();
      }
      
      if (!selectedRecords || selectedRecords.length === 0) {
        console.error('No records selected');
        return;
      }

      // Transform records into expected format
      const columnHeaders = [
        "Remarks", "Name", "Company", "Job Title", "Function", "Grade", "Profile URL", 
        "Status", "Func Root", "Profile Intro", "Skills", "Education Institute Ug", 
        "Education Institute Pg", "Mobile Phone", "E-mail Address", "Salary", "Experience", 
        "Priority", "Location", "Std. Location", "Notice Period", "Resume URL", 
        "Naukri Search URL", "Distance from Location", "Org Chart", "Company Name", 
        "Current Role Tenure", "Total Tenure", "Total Job Changes", "Average Tenure", 
        "Count Promotions", "Employees in Function", "Employees in Company", 
        "Employees at Location", "Progress", "Salary", "Experience", "Industry", 
        "Nationality", "Year Of Passing", "Blank_3", "Source", "Pull ID", 
        "Last Updated", "First Name", "Last Name", "Job", "ID"
      ];

      const transformedRecords = selectedRecords.map(record => {
        // Each record should be an array with null placeholders and specific data
        return [
          null, // Remarks
          null, // Name
          record.people?.name?.firstName + ' ' + record.people?.name?.lastName || '', // Full name
          record.jobs?.company?.name || '', // Company name
          record.people?.jobTitle || '', // Job title
          record.jobs?.pathPosition || 'unclassified', // Function
          record.jobs?.grade || 'entry', // Grade
          record.resdexNaukriUrl?.primaryLinkUrl ? 
            `<a href='${record.resdexNaukriUrl.primaryLinkUrl}' target='_blank' '>Naukri</a>` : '', // Profile URL
          record.source || 'Sourced', // Status
          record.funcRoot || '', // Func Root
          null, // Profile Intro
          record.skills || '', // Skills
          null, // Education Institute Ug
          null, // Education Institute Pg
          record.phoneNumber?.primaryPhoneNumber || '', // Mobile Phone
          record.email?.primaryEmail || '', // Email Address
          '10', // Salary
          4, // Experience
          null, // Priority
          record.jobs?.jobLocation?.split(',')[0] || '', // Location
          '', // Std. Location
          '0', // Notice Period
          null, // Resume URL
          record.hiringNaukriUrl?.primaryLinkUrl ? 
            `<a href='${record.hiringNaukriUrl.primaryLinkUrl}' target='_blank' '>Naukri Search URL</a>` : '', // Search URL
          null, // Distance from Location
          null, // Org Chart
          null, // Company Name
          null, // Current Role Tenure
          null, // Total Tenure
          null, // Total Job Changes
          null, // Average Tenure
          null, // Count Promotions
          null, // Employees in Function
          null, // Employees in Company
          null, // Employees at Location
          1, // Progress
          null, // Salary (duplicate)
          null, // Experience (duplicate)
          null, // Industry
          null, // Nationality
          null, // Year Of Passing
          null, // Blank_3
          null, // Source
          0, // Pull ID
          new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '; ' + 
            new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric' }), // Last Updated
          record.people?.name?.firstName || '', // First name
          record.people?.name?.lastName || '', // Last name
          'resdextesting', // Job
          record.id?.substring(0, 24) || '' // ID
        ];
      });
      console.log('Transformed records:', transformedRecords);
      // Prepare data for Chrome extension
      const data = {
        type: 'FROM_PAGE',
        text: JSON.stringify([transformedRecords]), // Wrap in additional array as per format
        columns: JSON.stringify(columnHeaders),
      };

      console.log('Data to send to WhatsApp extension:', data);

      // Post message to Chrome extension
      window.postMessage(data, window.location.origin);
      console.log('Message sent to WhatsApp extension');
      setIsWhatsappMessageModalOpen(false);
    } catch (error) {
      console.error('Error sending data to WhatsApp extension:', error);
    }
  }, [fetchAllRecords, isJobRoute, tableState]);

  const onClick = () => {
    if (!shouldBeRegistered) {
      return;
    }
    setIsWhatsappMessageModalOpen(true);
  };

  const confirmationModal = (
    <ConfirmationModal
      isOpen={isWhatsappMessageModalOpen}
      setIsOpen={setIsWhatsappMessageModalOpen}
      title={'Send to WhatsApp Chrome Ext.'}
      subtitle={`Are you sure you want to send contacts to WhatsApp Chrome Extension?`}
      onConfirmClick={handleSendToWhatsappClick}
      deleteButtonText={'Send to WhatsApp Chrome Extension'}
      confirmButtonAccent='blue'
    />
  );

  return {
    shouldBeRegistered,
    onClick,
    ConfirmationModal: confirmationModal,
  };
};
