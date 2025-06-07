import { tokenPairState } from '@/auth/states/tokenPairState';
import { afterChange, afterSelectionEnd, performRedo, performUndo, updateUnreadMessagesStatus } from '@/candidate-table/HotHooks';
import { chatSearchQueryState } from '@/candidate-table/states/chatSearchQueryState';
import { columnsSelector, processedDataSelector, tableStateAtom } from "@/candidate-table/states/states";
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useWebSocketEvent } from '@/websocket-context/useWebSocketEvent';
import styled from '@emotion/styled';
import HotTable from "@handsontable/react-wrapper";
import axios from 'axios';
import { CellChange, ChangeSource } from 'handsontable/common';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { IconPlus } from 'twenty-ui';


const StyledTableWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;


const StyledTableContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;


  .handsontable {
    overflow: visible;
  }

  .handsontable .ht_clone_top {
    z-index: 101;
  }

  /* Hide scrollbar only in header's wtHolder */
  .handsontable .ht_clone_top .wtHolder {
    overflow: hidden !important;
    -ms-overflow-style: none;
  }

  /* Hide scrollbar for the left fixed column */
  .handsontable .ht_clone_left .wtHolder {
    overflow: hidden !important;
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .handsontable .ht_clone_left .wtHolder::-webkit-scrollbar {
    display: none;
  }

  .handsontable .wtHolder {
    overflow: auto;
  }

  /* Style for selected rows */
  .handsontable tr.selected-row td {
    background-color: ${({ theme }) => theme.background.tertiary} !important;
  }

  /* Ensure selected row style persists on hover */
  .handsontable tr.selected-row:hover td {
    background-color: ${({ theme }) => theme.background.tertiary} !important;
  }
`;

const StyledLoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledErrorContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledEmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledEmptyIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: 50%;
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledEmptyTitle = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledEmptyDescription = styled.div`
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
  max-width: 300px;
`;

interface DataTableProps {
    jobId: string;
}

export const DataTable = forwardRef<{ refreshData: () => Promise<void> }, DataTableProps>(({ jobId }, ref) => {
    const tableRef = useRef<any>(null);
    const tableState = useRecoilValue(tableStateAtom);
    const setTableState = useSetRecoilState(tableStateAtom);
    const [tokenPair] = useRecoilState(tokenPairState);
    const processedData = useRecoilValue(processedDataSelector);
    const columns = useRecoilValue(columnsSelector);
    const searchQuery = useRecoilValue(chatSearchQueryState);
    const { openRightDrawer } = useRightDrawer();
    const setContextStoreTargetedRecordsRule = useSetRecoilComponentStateV2(
      contextStoreTargetedRecordsRuleComponentState,
      jobId
    );
    const setContextStoreNumberOfSelectedRecords = useSetRecoilComponentStateV2(
      contextStoreNumberOfSelectedRecordsComponentState,
      jobId
    );
    const filteredData = useMemo(() => {
      if (!searchQuery) return processedData;
      const query = searchQuery.toLowerCase();
      return processedData.filter((candidate: any) => {
        return Object.values(candidate).some(value => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }, [processedData, searchQuery]);

    const mutatableData = useMemo(() => {
      return filteredData.map((candidate: any) => ({
        ...candidate,
        isEditable: true
      }));
    }, [filteredData]);
  
    // const keyDownHandler = (event: KeyboardEvent) => {
    //   handleKeyDown(event, tableRef, tableState, setTableState);
    // };

    const afterChangeHandler = ( changes: CellChange[] | null, source: ChangeSource) => {
      console.log("changes and source in after Change Handler", changes, source);
      afterChange( tableRef, changes, source, jobId, tokenPair, setTableState, refreshData);
    }

    // const beforeOnCellMouseDownHandler = (event: MouseEvent, coords: { row: number; col: number }) => {
    //   console.log("event in beforeOnCellMouseDownHandler", event);
    //   beforeOnCellMouseDown(tableRef, event, coords, tableState , setTableState)
    // }

    const refreshData = useCallback(async (specificIds?: string[]) => {
      if (!jobId || jobId === "job-id") return;
      try {
        const requestBody = specificIds?.length 
          ? { jobId, candidateIds: specificIds }
          : { jobId };
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-candidates-by-job-id`,
          requestBody,
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
        );
        const rawData = response.data;
        const unreadMessagesCounts: Record<string, number> = {};
        rawData.forEach((candidate: any) => {
          if (!candidate || typeof candidate !== 'object' || !candidate.id) return;
          const unreadCount = candidate?.whatsappMessages?.edges
            ?.filter((edge: any) => edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate')
            ?.length || 0;
          unreadMessagesCounts[candidate.id] = unreadCount;
        });
        
        if (specificIds?.length) {
          setTableState(prev => {
            console.log("Partial refresh in refreshData", rawData);
            const updatedRawData = [...prev.rawData];
            for (const newData of rawData) {
              if (!newData || !newData.id) continue;
              const index = updatedRawData.findIndex(item => item.id === newData.id);
              if (index >= 0) {
                updatedRawData[index] = newData;
              } else {
                updatedRawData.push(newData);
              }
            }
            return { 
              ...prev, 
              rawData: updatedRawData,
              unreadMessagesCounts: { ...prev.unreadMessagesCounts, ...unreadMessagesCounts }
            };
          });
        } else {
          setTableState(prev => ({
            ...prev,
            rawData,
            unreadMessagesCounts,
            isLoading: false
          }));
        }
      } catch (error) {
        console.error('Data refresh failed:', error);
      }
    }, [jobId, setTableState, tokenPair]);
    
    // Expose the refreshData method through the ref
    useImperativeHandle(ref, () => ({
      refreshData
    }));

    const afterSelectionEndHandler = (row: number, column: number, row2: number, column2: number, selectionLayerLevel: number) => {
      console.log("row in afterSelectionEndHandler", row);
      afterSelectionEnd(tableRef, column, row, row2, setTableState, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule, openRightDrawer, tokenPair);
    }

    const loadData = useCallback(async () => {
      if (!jobId || jobId === "job-id") return;
      
      try {
        setTableState(prev => ({ ...prev, isLoading: true }));
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-candidates-by-job-id`,
          { jobId },
          { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
        );
        
        // Verify the response is valid
        const rawData = Array.isArray(response.data) ? response.data : [];
        console.log("This is raw data::", rawData);

        const columnsFields = rawData[0]?.candidateFieldValues?.edges?.map((field: any) => {
          return field?.node?.candidateFields?.name;
        });
        console.log("This is columns fields::", columnsFields);

        // Process unread messages for each candidate
        const unreadMessagesCounts: Record<string, number> = {};
        rawData.forEach(candidate => {
          if (!candidate || typeof candidate !== 'object') return;
          
          const unreadCount = candidate?.whatsappMessages?.edges
            ?.filter((edge: any) => edge?.node?.whatsappDeliveryStatus === 'receivedFromCandidate')
            ?.length || 0;
          
          if (candidate.id) {
            unreadMessagesCounts[candidate.id] = unreadCount;
          }
        });
        
        setTableState(prev => ({
          ...prev,
          rawData,
          unreadMessagesCounts,
          isLoading: false
        }));
      } catch (error) {
        console.error('Failed to load candidate data:', error);
        setTableState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          rawData: [],
          unreadMessagesCounts: {}
        }));
      }
    }, [jobId, setTableState, tokenPair]);
  

    useEffect(() => {
      loadData();
    }, [loadData]);

    const allVisibleIds = useMemo(() => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return [];
      
      return filteredData.map((row: any, index: number) => {
        const physicalRow = hot?.toPhysicalRow(index);
        const rowData = physicalRow !== undefined ? hot.getSourceDataAtRow(physicalRow) : row;
        return rowData?.id;
      }).filter(Boolean);
    }, [filteredData]);

    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: string) => tableState.selectedRowIds.includes(id));
    const noneSelected = allVisibleIds.every((id: string) => !tableState.selectedRowIds.includes(id));
    const someSelected = !allSelected && !noneSelected;

    const handleSelectAll = (checked: boolean) => {
      const hot = tableRef.current?.hotInstance;
      if (!hot) return;
      const visibleIds = filteredData.map((row: any, index: number) => {
        const physicalRow = hot?.toPhysicalRow(index);
        const rowData = physicalRow !== undefined ? hot.getSourceDataAtRow(physicalRow) : row;
        return rowData?.id;
      }).filter(Boolean);

      setTableState(prev => ({
        ...prev,
        selectedRowIds: checked ? visibleIds : []
      }));

      // Update context store states
      setContextStoreNumberOfSelectedRecords(checked ? visibleIds.length : 0);
      setContextStoreTargetedRecordsRule({
        mode: 'selection',
        selectedRecordIds: checked ? visibleIds : [],
      });
    };

    // Custom colHeaders: first column is empty string, others use column title
    const colHeaders = (col: number) => {
      if (col === 0) return '';
      return columns[col]?.title || '';
    };

    // afterGetColHeader hook to inject select-all checkbox
    const afterGetColHeader = (col: number, TH: HTMLTableCellElement) => {
      if (col === 0) {
        // Prevent duplicate checkboxes
        if (TH.querySelector('input[type="checkbox"]')) return;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.marginTop = '8px';
        checkbox.checked = allSelected;
        checkbox.indeterminate = someSelected;
        checkbox.style.cursor = 'pointer';
        checkbox.onclick = (e) => {
          e.stopPropagation();
          handleSelectAll(!allSelected);
        };
        // Clear and append
        TH.innerHTML = '';
        TH.appendChild(checkbox);
      } else {
        // Add title attribute for tooltip on other columns
        const columnTitle = columns[col]?.title || '';
        TH.title = columnTitle;
        TH.style.cursor = 'help';
      }
    };

    // Add WebSocket event listener for WhatsApp message updates
    useWebSocketEvent<{
      candidateId: string;
      jobId: string;
      messageId: string;
    }>('whatsapp_message_updated', async (data) => {
      // Only refresh if the message is for the current job
      if (data.jobId === jobId) {
        await refreshData();
        
        // If chat drawer is open for this candidate, refresh messages
        const hot = tableRef.current?.hotInstance;
        if (hot) {
          const selectedIds = hot.getSelected();
          if (selectedIds?.length === 1) {
            const row = selectedIds[0][0];
            const selectedRow = hot.getSourceDataAtRow(row);
            if (selectedRow?.id === data.candidateId) {
              // Fetch and update messages for the open chat
              try {
                const response = await axios.post(
                  `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/get-all-messages-by-candidate-id`,
                  { candidateId: data.candidateId },
                  { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } }
                );
                const unreadMessageIds = response.data
                  ?.filter((msg: any) => msg.whatsappDeliveryStatus === 'receivedFromCandidate')
                  ?.map((msg: any) => msg.id) || [];
                setTableState(prev => ({
                  ...prev,
                  unreadMessagesCounts: {
                    ...prev.unreadMessagesCounts,
                    [data.candidateId]: unreadMessageIds.length
                  }
                }));
                
                // Update message status if needed
                if (unreadMessageIds.length > 0) {
                  await updateUnreadMessagesStatus(unreadMessageIds, tokenPair);
                }
              } catch (error) {
                console.error('Error refreshing messages:', error);
              }
            }
          }
        }
      }
    }, [jobId, tokenPair]);

    if (tableState.isLoading) {
      return <StyledLoadingContainer>Loading candidates data...</StyledLoadingContainer>
    }
    
    if (tableState.error) {
      return <StyledErrorContainer>Error: {tableState.error}</StyledErrorContainer>
    }

    if (!processedData.length && !tableState.isLoading) {
      return (
        <StyledEmptyContainer>
          <StyledEmptyIcon>
            <IconPlus size={24} />
          </StyledEmptyIcon>
          <StyledEmptyTitle>No candidates found</StyledEmptyTitle>
          <StyledEmptyDescription>
            There are no candidates available for this job.
            <br />
            Add candidates to get started.
          </StyledEmptyDescription>
        </StyledEmptyContainer>
      );
    }
    
    return (
      <StyledTableWrapper>
        <StyledTableContainer>
          <HotTable
            ref={tableRef}
            data={mutatableData}
            columns={columns}
            colHeaders={colHeaders}
            afterGetColHeader={afterGetColHeader}
            rowHeaders={true}
            contextMenu={true}
            height="100%"
            themeName="ht-theme-main"
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            readOnly={false}
            className="htCenter"
            columnSorting={true}
            copyPaste={true}
            selectionMode="range"
            autoWrapRow={false}
            fixedRowsTop={0}
            afterSelectionEnd={afterSelectionEndHandler}
            afterChange={afterChangeHandler}
            autoWrapCol={false}
            autoRowSize={false}
            rowHeights={30}
            manualRowResize={true}
            manualColumnResize={true}
            manualColumnMove={true}
            filters={true}
            dropdownMenu={true}
            fixedColumnsLeft={1}
            customBorders={true}
            outsideClickDeselects={false}
            enterBeginsEditing={true}
            enterMoves={{ row: 1, col: 0 }}
            fillHandle={true}
            persistentState={true}
            beforeKeyDown={(event) => {
              // Handle Ctrl/Cmd + Z for undo
              if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
                event.preventDefault();
                performUndo(tableRef, setTableState);
              }
              // Handle Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
              if (((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) ||
                  ((event.ctrlKey || event.metaKey) && event.key === 'y')) {
                event.preventDefault();
                performRedo(tableRef, setTableState);
              }
            }}
          />
        </StyledTableContainer>
      </StyledTableWrapper>
      
    );
  });
