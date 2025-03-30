// import styled from '@emotion/styled';
// import { useEffect } from 'react';
// import { useRecoilCallback, useSetRecoilState } from 'recoil';

// import { ActionMenuComponentInstanceContext } from '@/action-menu/states/contexts/ActionMenuComponentInstanceContext';
// import { getActionMenuIdFromRecordIndexId } from '@/action-menu/utils/getActionMenuIdFromRecordIndexId';
// import { contextStoreCurrentObjectMetadataItemComponentState } from '@/context-store/states/contextStoreCurrentObjectMetadataItemComponentState';
// import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
// import { contextStoreCurrentViewTypeComponentState } from '@/context-store/states/contextStoreCurrentViewTypeComponentState';
// import { ContextStoreComponentInstanceContext } from '@/context-store/states/contexts/ContextStoreComponentInstanceContext';
// import { ContextStoreViewType } from '@/context-store/types/ContextStoreViewType';
// import { useMergedJobsAndCandidates } from '@/custom-layouts/hooks/useMergedJobsAndCandidates';
// import { ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
// import { lastShowPageRecordIdState } from '@/object-record/record-field/states/lastShowPageRecordId';
// import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
// import { RecordIndexContainer } from '@/object-record/record-index/components/RecordIndexContainer';
// import { RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect } from '@/object-record/record-index/components/RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect';
// import { RecordIndexLoadBaseOnContextStoreEffect } from '@/object-record/record-index/components/RecordIndexLoadBaseOnContextStoreEffect';
// import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
// import { RecordIndexContextProvider } from '@/object-record/record-index/contexts/RecordIndexContext';
// import { useHandleIndexIdentifierClick } from '@/object-record/record-index/hooks/useHandleIndexIdentifierClick';
// import { RecordSortsComponentInstanceContext } from '@/object-record/record-sort/states/context/RecordSortsComponentInstanceContext';
// import { PageBody } from '@/ui/layout/page/components/PageBody';
// import { PageContainer } from '@/ui/layout/page/components/PageContainer';
// import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
// import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
// import { PageTitle } from '@/video-interview/interview-response/StyledComponentsInterviewResponse';
// import { ViewComponentInstanceContext } from '@/views/states/contexts/ViewComponentInstanceContext';
// import { isNonEmptyString, isUndefined } from '@sniptt/guards';
// import { FieldMetadataType, isDefined } from 'twenty-shared';
// import { isError } from 'util';

// // Use the correct available states
// import { useCustomRecordData } from '@/custom-layouts/hooks/useCustomRecordData';
// import { recordIndexFieldDefinitionsState } from '@/object-record/record-index/states/recordIndexFieldDefinitionsState';
// import { recordIndexRecordIdsByGroupComponentFamilyState } from '@/object-record/record-index/states/recordIndexRecordIdsByGroupComponentFamilyState';
// import { recordIndexViewTypeState } from '@/object-record/record-index/states/recordIndexViewTypeState';
// import { ViewType } from '@/views/types/ViewType';

// const StyledIndexContainer = styled.div`
//   display: flex;
//   height: 100%;
//   width: 100%;
// `;

// // Create a merged metadata object that combines Job and Candidate fields
// const mergedObjectMetadata = {
//   __typename: 'ObjectMetadataItem',
//   id: 'merged-view',
//   dataSourceId: 'f2c6b48d-3a82-4a06-9c0b-0524edc2c831',
//   nameSingular: 'mergedView',
//   namePlural: 'mergedViews',
//   labelSingular: 'Job Candidate',
//   labelPlural: 'Job Candidates',
//   description: 'Combined view of Jobs and Candidates',
//   icon: 'IconBriefcase',
//   isCustom: true,
//   isRemote: false,
//   isActive: true,
//   isSystem: false,
//   createdAt: new Date().toISOString(),
//   updatedAt: new Date().toISOString(),
//   labelIdentifierFieldMetadataId: 'candidate-name',
//   imageIdentifierFieldMetadataId: null,
//   fields: [
//     {
//       __typename: 'Field',
//       id: 'candidate-name',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'candidateName',
//       label: 'Candidate Name',
//       description: 'Name of the candidate',
//       icon: 'IconUser',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: false,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'candidate-email',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'candidateEmail',
//       label: 'Email',
//       description: 'Email of the candidate',
//       icon: 'IconMail',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'candidate-phone',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'candidatePhone',
//       label: 'Phone',
//       description: 'Phone number of the candidate',
//       icon: 'IconPhone',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'candidate-status',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'candidateStatus',
//       label: 'Status',
//       description: 'Candidate status',
//       icon: 'IconStatusChange',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'chat-count',
//       type: 'NUMBER' as FieldMetadataType,
//       name: 'chatCount',
//       label: 'Chat Count',
//       description: 'Number of chats with candidate',
//       icon: 'IconMessageNumber',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'job-name',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'jobName',
//       label: 'Job Title',
//       description: 'Name of the job',
//       icon: 'IconBriefcase',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'job-location',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'jobLocation',
//       label: 'Job Location',
//       description: 'Location of the job',
//       icon: 'IconMapPin',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'job-code',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'jobCode',
//       label: 'Job Code',
//       description: 'Code of the job',
//       icon: 'IconBarcode',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'job-active',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'jobActive',
//       label: 'Job Status',
//       description: 'Active status of the job',
//       icon: 'IconCircleCheck',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//     {
//       __typename: 'Field',
//       id: 'company-name',
//       type: 'TEXT' as FieldMetadataType,
//       name: 'companyName',
//       label: 'Company',
//       description: 'Company name',
//       icon: 'IconBuilding',
//       isCustom: true,
//       isActive: true,
//       isSystem: false,
//       isNullable: true,
//       isUnique: false,
//       defaultValue: null,
//       options: null,
//       settings: null,
//       isLabelSyncedWithName: false,
//       relationDefinition: null,
//     },
//   ],
//   indexMetadatas: [], // Add any necessary indexes
// } as unknown as ObjectMetadataItem;

// // Main component
// const CustomLayoutMerged = () => {
//   const recordIndexId = 'merged-unique-id-for-merged-view';
//   const { loading, error, data: mergedData } = useMergedJobsAndCandidates();

//   const setContextStoreCurrentObjectMetadataItem = useSetRecoilComponentStateV2(
//     contextStoreCurrentObjectMetadataItemComponentState,
//     'main-context-store',
//   );

//   const setContextStoreCurrentViewId = useSetRecoilComponentStateV2(
//     contextStoreCurrentViewIdComponentState,
//     'main-context-store',
//   );

//   const setContextStoreCurrentViewType = useSetRecoilComponentStateV2(
//     contextStoreCurrentViewTypeComponentState,
//     'main-context-store',
//   );

//   const contextStoreCurrentViewId = 'merged-view-id';

//   const currentObjectMetadataItem = useRecoilComponentValueV2(
//     contextStoreCurrentObjectMetadataItemComponentState,
//     'main-context-store',
//   );

//   const handleIndexRecordsLoaded = useRecoilCallback(
//     ({ set }) =>
//       () => {
//         set(lastShowPageRecordIdState, null);
//       },
//     [],
//   );

//   const { indexIdentifierUrl } = useHandleIndexIdentifierClick({
//     objectMetadataItem: mergedObjectMetadata,
//     recordIndexId,
//   });

//   // Set the view type to Table
//   const setRecordIndexViewType = useSetRecoilState(recordIndexViewTypeState);

//   // Setup field definitions for the table
//   const setRecordIndexFieldDefinitions = useSetRecoilState(
//     recordIndexFieldDefinitionsState,
//   );

//   // Add this to initialize the record IDs in the group state
//   const setRecordIdsInGroup = useRecoilCallback(
//     ({ set }) =>
//       () => {
//         if (mergedData && mergedData.length > 0) {
//           // The default group ID for records when not using groups
//           const defaultGroupId = 'default';

//           // Store the record IDs in the group state
//           set(
//             recordIndexRecordIdsByGroupComponentFamilyState(defaultGroupId),
//             mergedData.map((record) => record.id),
//           );
//         }
//       },
//     [mergedData],
//   );

//   // Add field definitions for the table columns
//   useEffect(() => {
//     // Define the columns for the table
//     const fieldDefinitions = [
//       {
//         fieldId: 'candidate-name',
//         label: 'Candidate Name',
//         type: 'TEXT',
//         iconName: 'IconUser',
//         size: 180,
//         position: 0,
//         isVisible: true,
//       },
//       {
//         fieldId: 'candidate-email',
//         label: 'Email',
//         type: 'TEXT',
//         iconName: 'IconMail',
//         size: 180,
//         position: 1,
//         isVisible: true,
//       },
//       {
//         fieldId: 'candidate-status',
//         label: 'Status',
//         type: 'TEXT',
//         iconName: 'IconStatusChange',
//         size: 120,
//         position: 2,
//         isVisible: true,
//       },
//       {
//         fieldId: 'job-name',
//         label: 'Job Title',
//         type: 'TEXT',
//         iconName: 'IconBriefcase',
//         size: 180,
//         position: 3,
//         isVisible: true,
//       },
//       {
//         fieldId: 'job-location',
//         label: 'Job Location',
//         type: 'TEXT',
//         iconName: 'IconMapPin',
//         size: 150,
//         position: 4,
//         isVisible: true,
//       },
//       {
//         fieldId: 'company-name',
//         label: 'Company',
//         type: 'TEXT',
//         iconName: 'IconBuilding',
//         size: 150,
//         position: 5,
//         isVisible: true,
//       },
//     ];

//     setRecordIndexFieldDefinitions(fieldDefinitions);
//     setRecordIndexViewType(ViewType.Table);
//   }, [setRecordIndexFieldDefinitions, setRecordIndexViewType]);

//   // Initialize context store and record IDs immediately
//   useEffect(() => {
//     setContextStoreCurrentObjectMetadataItem(mergedObjectMetadata);
//     setContextStoreCurrentViewId(contextStoreCurrentViewId);
//     setContextStoreCurrentViewType(ContextStoreViewType.Table);

//     // Initialize table data when available
//     if (mergedData && mergedData.length > 0) {
//       setRecordIdsInGroup();
//     }
//   }, [
//     setContextStoreCurrentObjectMetadataItem,
//     setContextStoreCurrentViewId,
//     setContextStoreCurrentViewType,
//     mergedData,
//     setRecordIdsInGroup,
//   ]);

//   const { getRecordById, getAllRecords } = useCustomRecordData(
//     recordIndexId,
//     mergedData || [],
//   );

//   if (
//     isUndefined(currentObjectMetadataItem) ||
//     !isNonEmptyString(contextStoreCurrentViewId)
//   ) {
//     return null;
//   }

//   if (loading) {
//     return <div>Loading job and candidate data...</div>;
//   }

//   if (isDefined(error) && isError(error)) {
//     return <div>Error loading data: {error.message}</div>;
//   }

//   return (
//     <PageContainer>
//       <ContextStoreComponentInstanceContext.Provider
//         value={{ instanceId: 'main-context-store' }}
//       >
//         <RecordIndexContextProvider
//           value={{
//             recordIndexId,
//             objectNamePlural: mergedObjectMetadata.namePlural,
//             objectNameSingular: mergedObjectMetadata.nameSingular,
//             objectMetadataItem: mergedObjectMetadata,
//             onIndexRecordsLoaded: handleIndexRecordsLoaded,
//             indexIdentifierUrl,
//             getRecordById,
//             getAllRecords,
//           }}
//         >
//           <ViewComponentInstanceContext.Provider
//             value={{ instanceId: recordIndexId }}
//           >
//             <RecordFiltersComponentInstanceContext.Provider
//               value={{ instanceId: recordIndexId }}
//             >
//               <RecordSortsComponentInstanceContext.Provider
//                 value={{ instanceId: recordIndexId }}
//               >
//                 <ActionMenuComponentInstanceContext.Provider
//                   value={{
//                     instanceId: getActionMenuIdFromRecordIndexId(recordIndexId),
//                   }}
//                 >
//                   <PageTitle title="Jobs & Candidates" />
//                   <RecordIndexPageHeader />
//                   <PageBody>
//                     <StyledIndexContainer>
//                       <RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect />
//                       <RecordIndexContainer />
//                     </StyledIndexContainer>
//                   </PageBody>
//                   <RecordIndexLoadBaseOnContextStoreEffect />
//                 </ActionMenuComponentInstanceContext.Provider>
//               </RecordSortsComponentInstanceContext.Provider>
//             </RecordFiltersComponentInstanceContext.Provider>
//           </ViewComponentInstanceContext.Provider>
//         </RecordIndexContextProvider>
//       </ContextStoreComponentInstanceContext.Provider>
//     </PageContainer>
//   );
// };

// export default CustomLayoutMerged;
