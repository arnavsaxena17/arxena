import { tokenPairState } from '@/auth/states/tokenPairState';
import { afterChange, afterSelectionEnd } from '@/candidate-table/HotHooks';
import { columnsSelector, processedDataSelector, tableStateAtom } from "@/candidate-table/states";
import styled from '@emotion/styled';
import HotTable from "@handsontable/react-wrapper";
import axios from "axios";
import { CellChange, ChangeSource } from 'handsontable/common';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { CandidateNode } from 'twenty-shared';
import { IconPlus } from 'twenty-ui';

const StyledTableContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
  position: relative;
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
  

  export const DataTable: React.FC<DataTableProps> = ({ jobId }) => {
    const tableRef = useRef<any>(null);
    const tableState = useRecoilValue(tableStateAtom);
    const setTableState = useSetRecoilState(tableStateAtom);
    const [tokenPair] = useRecoilState(tokenPairState);
    const processedData = useRecoilValue(processedDataSelector);
    const columns = useRecoilValue(columnsSelector);

    console.log("processedData in DataTable", processedData);


    const mutatableData = useMemo(() => {
      return processedData.map((candidate: any) => ({
        ...candidate,
        isEditable: true
      }));
    }, [processedData]);
  
    // const keyDownHandler = (event: KeyboardEvent) => {
    //   handleKeyDown(event, tableRef, tableState, setTableState);
    // };

    const afterChangeHandler = ( changes: CellChange[] | null, source: ChangeSource) => {
      console.log("changes, source in afterChangeHandler", changes, source);
      afterChange( tableRef, changes, source, jobId, tokenPair, setTableState);
    }

    // const beforeOnCellMouseDownHandler = (event: MouseEvent, coords: { row: number; col: number }) => {
    //   console.log("event in beforeOnCellMouseDownHandler", event);
    //   beforeOnCellMouseDown(tableRef, event, coords, tableState , setTableState)
    // }

    const afterSelectionEndHandler = (row: number, column: number, row2: number, column2: number, selectionLayerLevel: number) => {
      console.log("row in afterSelectionEndHandler", row);
      afterSelectionEnd(tableRef, row, row2, setTableState);
    }
    const loadData = useCallback(async () => {
      if (!jobId) return;
      
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
  
    // const setupTable = useCallback(() => {
    //   if (!tableRef.current) return;
    //   const hot = tableRef.current.hotInstance;
    //   console.log("hot in setupTable", hot);      
    // }, [setTableState, jobId]);
  
    // Initial data load
    useEffect(() => {
      loadData();
    }, [loadData]);
    
    // Setup table after render
    // useEffect(() => {
    //   setupTable();
    // }, [setupTable]);
  
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
          colHeaders={true}
          rowHeaders={true}
          contextMenu={true}
          height="auto"
          themeName="ht-theme-main"
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          readOnly={false}
          className="htCenter"
          columnSorting={true}
          selectionMode="range"
          autoWrapRow={false}
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
        />
      </StyledTableContainer>
    );
  };

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