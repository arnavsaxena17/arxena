import { tokenPairState } from '@/auth/states/tokenPairState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { HotTable } from '@handsontable/react-wrapper';
import { IconCopy } from '@tabler/icons-react';
import axios from 'axios';
import dayjs from 'dayjs';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import React, { useMemo, useState } from 'react';
import { useRecoilState } from 'recoil';
import { PersonNode } from 'twenty-shared';
import ActionsBar from './ActionsBar';
import AttachmentPanel from './AttachmentPanel';
import MultiCandidateChat from './MultiCandidateChat';

registerAllModules();

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  white-space: nowrap;
  text-overflow: ellipsis;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 768px) {
    margin: 0;
    padding: 0;
  }
`;

const PanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 80px;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  height: calc(100vh - 80px);
  background-color: #f5f5f5;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease-in-out;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

const CandidateNavigation = styled.div`
  position: fixed;
  top: 50%;
  right: 41%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 1001;
`;

const NavIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: #f3f4f6;
    transform: scale(1.05);
  }

  &:disabled {
    background-color: #e5e7eb;
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
  }

  color: #374151;
  background-color: white;

  &:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

interface ChatTableProps {
  individuals: PersonNode[];
  selectedIndividual: string | null;
  unreadMessages: {
    listOfUnreadMessages: Array<{
      candidateId: string;
      ManyUnreadMessages: any[];
    }>;
  };
  onIndividualSelect: (id: string) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onBulkMessage?: (selectedIds: string[]) => void;
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkAssign?: (selectedIds: string[]) => void;
  onReorder?: (selectedIds: PersonNode[]) => void;
}

const ChatTable: React.FC<ChatTableProps> = ({
  individuals,
  selectedIndividual,
  unreadMessages,
  onIndividualSelect,
  onSelectionChange,
  onBulkMessage,
  onBulkDelete,
  onBulkAssign,
  onReorder,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  const theme = useTheme();

  const getUnreadCount = (individualId: string) => {
    const candidateId = individuals.find(ind => ind.id === individualId)?.candidates?.edges[0]?.node?.id;
    const unreadInfo = unreadMessages.listOfUnreadMessages.find(item => item.candidateId === candidateId);
    return unreadInfo ? unreadInfo.ManyUnreadMessages.length : 0;
  };

  const handleCheckboxChange = (individualId: string) => {
    const newSelectedIds = selectedIds.includes(individualId)
      ? selectedIds.filter(id => id !== individualId)
      : [...selectedIds, individualId];

    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  const handleSelectAll = () => {
    const newSelectedIds = selectedIds.length === individuals.length ? [] : individuals.map(individual => individual.id);
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  const handleViewChats = () => {
    if (selectedIds.length > 0) {
      setIsChatOpen(true);
    }
  };

  const handleViewCVs = () => {
    setCurrentPersonIndex(0);
    setIsAttachmentPanelOpen(true);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    onSelectionChange?.([]);
  };

  const handlePrevCandidate = () => {
    setCurrentPersonIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextCandidate = () => {
    setCurrentPersonIndex(prev => Math.min(selectedIds.length - 1, prev + 1));
  };

  const currentCandidate = selectedIds.length > 0 ? individuals.find(individual => individual.id === selectedIds[currentPersonIndex]) : null;

  const selectedPeople = individuals.filter(individual => selectedIds.includes(individual.id));
  const selectedCandidateIds = selectedPeople.map(person => person.candidates.edges[0].node.id);

  const createCandidateShortlists = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/create-shortlist',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Shortlist created successfully', {
        variant: SnackBarVariant.Success,
        icon: <IconCopy size={theme.icon.size.md} />,
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error creating shortlist', {
        variant: SnackBarVariant.Error,
        icon: <IconCopy size={theme.icon.size.md} />,
        duration: 2000,
      });
    }
  };

  const createChatBasedShortlistDelivery = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/chat-based-shortlist-delivery',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Shortlist created successfully', {
        variant: SnackBarVariant.Success,
        icon: <IconCopy size={theme.icon.size.md} />,
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error creating shortlist', {
        variant: SnackBarVariant.Error,
        icon: <IconCopy size={theme.icon.size.md} />,
        duration: 2000,
      });
    }
  };

  const createUpdateCandidateStatus = async () => {
    try {
      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL + '/arx-chat/refresh-chat-status-by-candidates',
        { candidateIds: selectedCandidateIds },
        { headers: { authorization: `Bearer ${tokenPair?.accessToken?.token}`, 'content-type': 'application/json', 'x-schema-version': '66' } },
      );
      enqueueSnackBar('Status updated successfully', {
        variant: SnackBarVariant.Success,
        icon: <IconCopy size={theme.icon.size.md} />,
        duration: 2000,
      });
    } catch (error) {
      enqueueSnackBar('Error updating status', {
        variant: SnackBarVariant.Error,
        icon: <IconCopy size={theme.icon.size.md} />,
        duration: 2000,
      });
    }
  };

  type TableData = {
    id: string;
    name: string;
    candidateStatus: string;
    startDate: string;
    status: string;
    salary: string;
    city: string;
    jobTitle: string;
    checkbox: boolean;
  };

  const prepareTableData = (individuals: PersonNode[]): TableData[] => {
    return individuals.map(individual => ({
      id: individual.id,
      name: `${individual.name.firstName} ${individual.name.lastName}`,
      candidateStatus: individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A',
      startDate: individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt 
        ? dayjs(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
        : 'N/A',
      status: individual.candidates?.edges[0]?.node?.status || 'N/A',
      salary: individual.salary || 'N/A',
      city: individual.city || 'N/A',
      jobTitle: individual.jobTitle || 'N/A',
      checkbox: selectedIds.includes(individual.id)
    }));
  };

  const columns: Handsontable.ColumnSettings[] = [
    {
      data: 'checkbox',
      type: 'checkbox',
      width: 40,
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = value;
        checkbox.addEventListener('change', () => {
          const individual = individuals[row];
          handleCheckboxChange(individual.id);
        });
        td.appendChild(checkbox);
        return td;
      },
    },
    {
      data: 'name',
      title: 'Name',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const name = `${individual.name.firstName} ${individual.name.lastName}`;
        td.textContent = name;
        return td;
      },
    },
    {
      data: 'candidateStatus',
      title: 'Candidate Status',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const status = individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A';
        td.textContent = status;
        return td;
      },
    },
    {
      data: 'startDate',
      title: 'Start Date',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const date = individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt 
          ? dayjs(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).format('MMM D, HH:mm')
          : 'N/A';
        td.textContent = date;
        return td;
      },
    },
    {
      data: 'status',
      title: 'Status',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const status = individual.candidates?.edges[0]?.node?.status || 'N/A';
        td.textContent = status;
        return td;
      },
    },
    {
      data: 'salary',
      title: 'Salary',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const salary = individual.salary || 'N/A';
        td.textContent = salary;
        return td;
      },
    },
    {
      data: 'city',
      title: 'City',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const city = individual.city || 'N/A';
        td.textContent = city;
        return td;
      },
    },
    {
      data: 'jobTitle',
      title: 'Job Title',
      renderer: (
        instance: Handsontable.Core,
        td: HTMLTableCellElement,
        row: number,
        column: number,
        prop: string | number,
        value: any,
        cellProperties: Handsontable.CellProperties
      ) => {
        const individual = individuals[row];
        const jobTitle = individual.jobTitle || 'N/A';
        td.textContent = jobTitle;
        return td;
      },
    },
  ];

  const hotTableComponent = useMemo(
    () => (
      <HotTable
        data={prepareTableData(individuals)}
        columns={columns}
        colHeaders={true}
        rowHeaders={true}
        height="auto"
        licenseKey="non-commercial-and-evaluation"
        stretchH="all"
        className="htCenter"
        readOnly={true}
        autoWrapRow={true}
        autoWrapCol={true}
        manualRowResize={true}
        manualColumnResize={true}
        contextMenu={true}
        filters={true}
        dropdownMenu={true}
        hiddenColumns={{
          columns: [0],
          indicators: true,
        }}
      />
    ),
    [individuals, selectedIds]
  );

  return (
    <>
      <TableContainer>
        {hotTableComponent}
      </TableContainer>

      <ActionsBar
        selectedIds={selectedIds}
        clearSelection={clearSelection}
        handleViewChats={handleViewChats}
        handleViewCVs={handleViewCVs}
        createChatBasedShortlistDelivery={createChatBasedShortlistDelivery}
        createUpdateCandidateStatus={createUpdateCandidateStatus}
        createCandidateShortlists={createCandidateShortlists}
      />

      <MultiCandidateChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedPeople={selectedPeople} />

      {isAttachmentPanelOpen && currentCandidate && (
        <>
          <AttachmentPanel
            isOpen={isAttachmentPanelOpen}
            onClose={() => setIsAttachmentPanelOpen(false)}
            candidateId={currentCandidate.candidates.edges[0].node.id}
            candidateName={`${currentCandidate.name.firstName} ${currentCandidate.name.lastName}`}
            PanelContainer={PanelContainer}
          />

          {selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen) && (
            <CandidateNavigation>
              <NavIconButton onClick={handlePrevCandidate} disabled={currentPersonIndex === 0} title="Previous Candidate">
                ←
              </NavIconButton>

              <NavIconButton onClick={handleNextCandidate} disabled={currentPersonIndex === selectedIds.length - 1} title="Next Candidate">
                →
              </NavIconButton>
            </CandidateNavigation>
          )}
        </>
      )}
    </>
  );
};

export default ChatTable;
