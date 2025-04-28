import { chatSearchQueryState } from '@/activities/chats/states/chatSearchQueryState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { afterChange, afterSelectionEnd } from '@/candidate-table/HotHooks';
import { columnsSelector, processedDataSelector, tableStateAtom } from "@/candidate-table/states";
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { contextStoreTargetedRecordsRuleComponentState } from '@/context-store/states/contextStoreTargetedRecordsRuleComponentState';
import { useRightDrawer } from '@/ui/layout/right-drawer/hooks/useRightDrawer';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import styled from '@emotion/styled';
import HotTable from "@handsontable/react-wrapper";
import axios from 'axios';
import { CellChange, ChangeSource } from 'handsontable/common';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { CandidateNode } from 'twenty-shared';
import { IconPlus } from 'twenty-ui';

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
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .handsontable .ht_clone_top .wtHolder::-webkit-scrollbar {
    display: none;
  }

  .handsontable .wtHolder {
    overflow: auto;
  }

  .ht_clone_inline_start .wtHolder {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE 10+ */
  }
  .ht_clone_inline_start .wtHolder::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
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
        
        const rawData: CandidateNode[] = response.data;
        if (specificIds?.length) {
          setTableState(prev => {
            console.log("Partial refresh in refreshData", rawData);
            const updatedRawData = [...prev.rawData];
            for (const newData of rawData) {
              const index = updatedRawData.findIndex(item => item.id === newData.id);
              if (index >= 0) {
                updatedRawData[index] = newData;
              } else {
                updatedRawData.push(newData);
              }
            }
            return { ...prev, rawData: updatedRawData };
          });
        } else {
          console.log("Full refresh in refreshData", rawData);
          setTableState(prev => ({
            ...prev,
            rawData,
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
      afterSelectionEnd(tableRef, column, row, row2, setTableState, setContextStoreNumberOfSelectedRecords, setContextStoreTargetedRecordsRule, openRightDrawer);
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
        const rawData:CandidateNode[] = response.data;
        console.log(rawData);
        setTableState(prev => ({
          ...prev,
          rawData,
          isLoading: false
        }));
      } catch (error) {
        setTableState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }));
      }
    }, [jobId, setTableState, tokenPair]);
  

  
    // Initial data load
    useEffect(() => {
      loadData();
    }, [loadData]);

  
    // Compute select-all state for visible rows
    const allVisibleIds = useMemo(() => filteredData.map((row: any) => row.id), [filteredData]);
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id: string) => tableState.selectedRowIds.includes(id));
    const noneSelected = allVisibleIds.every((id: string) => !tableState.selectedRowIds.includes(id));
    const someSelected = !allSelected && !noneSelected;

    // Handler for select-all checkbox
    const handleSelectAll = (checked: boolean) => {
      setTableState(prev => ({
        ...prev,
        selectedRowIds: checked ? allVisibleIds : []
      }));
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
      }
    };

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
            There are no candidates available for this job. Add candidates to get started.
          </StyledEmptyDescription>
        </StyledEmptyContainer>
      );
    }
    
    return (
      <StyledTableContainer>
        <HotTable
          ref={tableRef}
          data={mutatableData}
          columns={columns}
          colHeaders={colHeaders}
          afterGetColHeader={afterGetColHeader}
          rowHeaders={true}
          contextMenu={true}
          height="calc(100vh - 200px)"
          themeName="ht-theme-main"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          readOnly={false}
          className="htCenter"
          columnSorting={true}
          selectionMode="range"
          autoWrapRow={false}
          fixedRowsTop={0}
          afterSelectionEnd={afterSelectionEndHandler}
          afterChange={afterChangeHandler}
          // beforeOnCellMouseDown={beforeOnCellMouseDownHandler}
          // beforeKeyDown={keyDownHandler}
          autoWrapCol={false}
          autoRowSize={false}
          rowHeights={30}
          manualRowResize={true}
          manualColumnResize={true}
          manualColumnMove={true}
          filters={true}
          dropdownMenu={true}
          fixedColumnsLeft={1}
        />
      </StyledTableContainer>
      
    );
  });

//   <HotTable
//   ref={hotRef}
//   themeName="ht-theme-main"
//   data={tableState.data}
//   columns={tableState.columns}
//   colHeaders={true}
//   rowHeaders={true}
//   height="auto"
//   licenseKey="non-commercial-and-evaluation"
//   stretchH="all"
//   className="htCenter"
//   columnSorting={true}
//   readOnly={false}
//   selectionMode="range"
//   autoWrapRow={false}
//   autoWrapCol={false}
//   autoRowSize={false}
//   rowHeights={30}
//   manualRowResize={true}
//   manualColumnResize={true}
//   filters={true}
//   dropdownMenu={true}
// />