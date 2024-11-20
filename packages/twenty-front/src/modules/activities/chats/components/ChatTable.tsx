import React, { useEffect, useState } from 'react';
import styled from "@emotion/styled";
import { IconX, IconUsers,IconFileText,IconChevronLeft, IconGripVertical,IconMessages,IconChevronRight, IconSend, IconTrash, IconChevronUp, IconChevronDown, IconLink, IconCopy } from '@tabler/icons-react';
import * as frontChatTypes from "../types/front-chat-types";
import AttachmentPanel from './AttachmentPanel';
import MultiCandidateChat from './MultiCandidateChat';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';

import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Button } from '@/ui/input/button/components/Button';
import { useTheme } from '@emotion/react';

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
  top: 80px; // Moved up from the default position
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  height: calc(100vh - 80px); // Adjusted height to account for new top position
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

  // Make buttons more visible with a white background
  color: #374151;
  background-color: white;
  
  // Add hover state shadow
  &:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;

const StyledTableRow = styled.div<{ $selected: boolean; $isDragging?: boolean }>`
  display: table-row;
  height: 12px;
  background-color: ${(props) => {
    if (props.$isDragging) return "#e5e7eb";
    return props.$selected ? "#f5f9fd" : "white";
  }};
  cursor: pointer;
  
  &:hover {
    background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
  }
  
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    padding: 0.25rem;
    border-bottom: 1px solid #e0e0e0;
    position: relative;
  }
`;


const CheckboxWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
`;

const DragHandle = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  color: #9CA3AF;
  transition: all 0.2s ease;
  margin-right: 0.5rem;
  cursor: grab;
  
  &:hover {
    background-color: #F3F4F6;
    color: #4B5563;
  }
  
  &:active {
    cursor: grabbing;
    background-color: #E5E7EB;
  }
`;


const StyledCheckbox = styled.input`
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #D1D5DB;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #9CA3AF;
    background-color: #F9FAFB;
  }
  
  &:checked {
    background-color: #2563EB;
    border-color: #2563EB;
    
    &:after {
      content: '';
      position: absolute;
      left: 5px;
      top: 2px;
      width: 6px;
      height: 10px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
    
    &:hover {
      background-color: #1D4ED8;
      border-color: #1D4ED8;
    }
  }
  
  &:focus {
    outline: 2px solid #2563EB;
    outline-offset: 2px;
  }
`;


const CheckboxCell = styled.div`
  display: table-cell;
  padding: 0.25rem;
  width: 40px;
  text-align: left;
  
  > div {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  @media (max-width: 768px) {
    position: absolute;
    left: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
  }
`;


const ActionsBar = styled.div`
  position: fixed;
  bottom: 0;
  left: 30%;
  width: 40%;
  right: 0;
  background-color: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transform: translateY(100%);
  transition: transform 0.3s ease-in-out;
  z-index: 1000;
  
  &[data-visible="true"] {
    transform: translateY(0);
  }
`;

const SelectedCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #4b5563;
  font-weight: 500;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s;
  
  &.primary {
    background-color: #2563eb;
    color: white;
    
    &:hover {
      background-color: #1d4ed8;
    }
  }
  
  &.secondary {
    background-color: #f3f4f6;
    color: #374151;
    
    &:hover {
      background-color: #e5e7eb;
    }
  }
  
  &.danger {
    background-color: #ef4444;
    color: white;
    
    &:hover {
      background-color: #dc2626;
    }
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border-radius: 0.375rem;
  color: #6b7280;
  
  &:hover {
    background-color: #f3f4f6;
  }
`;


// const CheckboxCell = styled.div`
//   display: table-cell;
//   padding: 1rem;
//   width: 40px;
//   text-align: center;
  
//   @media (max-width: 768px) {
//     position: absolute;
//     left: 1rem;
//     top: 50%;
//     transform: translateY(-50%);
//   }
// `;

const Checkbox = styled.input`
  width: 16px;
  height: 16px;
  cursor: pointer;
`;



const StyledTable = styled.div`
  width: 100%;
  display: table;
  border-collapse: collapse;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const StyledTableCell = styled.div`
  display: table-cell;
  padding: 0.25rem 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  width: 150px;

  @media (max-width: 768px) {
    display: flex;
    padding: 0.5rem 0;
    border: none;
    
    &:before {
      content: attr(data-label);
      font-weight: 600;
      width: 100px;
      min-width: 100px;
    }
  }
`;

const StyledTableHeaderCell = styled.div<{ isSorted: boolean }>`
  display: table-cell;
  padding: 0.25rem 0.5rem;
  font-weight: 600;
  text-align: left;
  border-bottom: 2px solid #e0e0e0;
  background-color: #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: #e8e8e8;
  }

  ${({ isSorted }) => isSorted && `
    background-color: #e8e8e8;
  `}
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SortIconsContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: 4px;
`;

const SortIcon = styled.div<{ isActive: boolean }>`
  color: ${({ isActive }) => isActive ? '#2563eb' : '#a0a0a0'};
  display: flex;
  align-items: center;
  margin-top: -2px;
  margin-bottom: -2px;
`;

const StyledTableBody = styled.div`
  display: table-row-group;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const StyledTableHeader = styled.div`
  display: table-header-group;
  position: sticky;
  top: 0;
  z-index: 1;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

// const StyledTableRow = styled.div<{ $selected: boolean }>`
//   display: table-row;
//   background-color: ${(props) => (props.$selected ? "#f5f9fd" : "white")};
//   cursor: pointer;
  
//   &:hover {
//     background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
//   }
  
//   @media (max-width: 768px) {
//     display: flex;
//     flex-direction: column;
//     padding: 1rem;
//     border-bottom: 1px solid #e0e0e0;
//     position: relative;
//   }
// `;

const UnreadIndicator = styled.span`
  background-color: red;
  color: white;
  border-radius: 50%;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  min-height: 1rem;
  min-width: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  @media (max-width: 768px) {
    position: absolute;
    top: 1rem;
    right: 1rem;
  }
`;

const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  @media (max-width: 768px) {
    font-weight: 600;
  }
`;

const DraggableTableRow = ({
  individual,
  index,
  selectedIndividual,
  selectedIds,
  handleCheckboxChange,
  onIndividualSelect,
  getUnreadCount,
}: {
  individual: frontChatTypes.PersonNode;
  index: number;
  selectedIndividual: string | null;
  selectedIds: string[];
  handleCheckboxChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onIndividualSelect: (id: string) => void;
  getUnreadCount: (id: string) => number;
}) => {
  const unreadCount = getUnreadCount(individual?.id);
  const messageTime = new Date(individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt)
  .toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  console.log("messageTime:",messageTime)
  console.log("individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt:",individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt)
  return (
    console.log("individual:",individual),
    <Draggable draggableId={individual.id} index={index}>
      {(provided, snapshot) => (
        <StyledTableRow
          ref={provided.innerRef}
          {...provided.draggableProps}
          $selected={selectedIndividual === individual?.id}
          $isDragging={snapshot.isDragging}
          onClick={() => onIndividualSelect(individual?.id)}
          data-selectable-id={individual.id}
        >
          <CheckboxCell onClick={e => e.stopPropagation()}>
            <div {...provided.dragHandleProps}>
              <IconGripVertical size={20} />
            </div>
            <Checkbox
              type="checkbox"
              checked={selectedIds.includes(individual.id)}
              onChange={e => handleCheckboxChange(individual.id, e)}
            />
          </CheckboxCell>
          <StyledTableCell>
            <NameCell>
              {`${individual.name.firstName} ${individual.name.lastName}`}
              {unreadCount > 0 && <UnreadIndicator>{unreadCount}</UnreadIndicator>}
            </NameCell>
          </StyledTableCell>
          <StyledTableCell> {individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A'} </StyledTableCell>
          <StyledTableCell>
            {individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt ? messageTime : 'N/A'}
          </StyledTableCell>
          <StyledTableCell> {individual.candidates?.edges[0]?.node?.status || 'N/A'} </StyledTableCell>
          <StyledTableCell>{individual.salary || 'N/A'}</StyledTableCell>
          <StyledTableCell>{individual.city || 'N/A'}</StyledTableCell>
          <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
        </StyledTableRow>
      )}
    </Draggable>
  );
};



interface ChatTableProps extends frontChatTypes.ChatTableProps {
  onSelectionChange?: (selectedIds: string[]) => void;
  onBulkMessage?: (selectedIds: string[]) => void;
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkAssign?: (selectedIds: string[]) => void;
  onReorder?: (selectedIds: frontChatTypes.PersonNode[]) => void;
}


interface SortConfig {
  key: string | null;
  direction: 'asc' | 'desc' | null;
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: null
  });

  

  const [tableData, setTableData] = useState(individuals);
  useEffect(() => {
    setTableData(individuals);
  }, [individuals]);

  const { enqueueSnackBar } = useSnackBar();
  const theme = useTheme();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');

  const [isChatOpen, setIsChatOpen] = useState(false);

  const currentCandidate = selectedIds.length > 0 ? 
  individuals.find(individual => individual.id === selectedIds[currentCandidateIndex]) : null;

  const handleCheckboxChange = (individualId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const newSelectedIds = event.target.checked
      ? [...selectedIds, individualId]
      : selectedIds.filter(id => id !== individualId);
    
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  const selectedPeople = individuals.filter(individual => 
    selectedIds.includes(individual.id)
  );

  console.log("selectedIds:",selectedIds)
  console.log("selectedPeople:",selectedPeople)
  console.log("individuals:",individuals)

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedIds = event.target.checked
      ? individuals.map(individual => individual.id)
      : [];
    
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  };

  useEffect(() => {
    let filteredData = filterData(individuals, searchTerm);
    if (sortConfig.key && sortConfig.direction) {
      filteredData = sortData(filteredData, sortConfig.key, sortConfig.direction);
    }
    setTableData(filteredData);
  }, [searchTerm, individuals, sortConfig]);

  const handleViewChats = () => {
    console.log("View Chats");
    if (selectedIds.length > 0) {
      setIsChatOpen(true);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
    onSelectionChange?.([]);
  };
  const handleViewCVs = () => {
    console.log("View CVs");
    setCurrentCandidateIndex(0);
    setIsAttachmentPanelOpen(true);
  };

  const handlePrevCandidate = () => {
    setCurrentCandidateIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextCandidate = () => {
    setCurrentCandidateIndex(prev => Math.min(selectedIds.length - 1, prev + 1));
  };

  const filterData = (data: frontChatTypes.PersonNode[], term: string) => {
    if (!term) return data;
    
    return data.filter(individual => {
      const searchString = `
        ${individual.name.firstName} 
        ${individual.name.lastName} 
        ${individual.city || ''} 
        ${individual.jobTitle || ''} 
        ${individual.salary || ''} 
        ${individual.candidates?.edges[0]?.node?.status || ''} 
        ${individual.candidates?.edges[0]?.node?.candConversationStatus || ''}
      `.toLowerCase();
      
      return searchString.includes(term.toLowerCase());
    });
  };


  const sortData = (data: frontChatTypes.PersonNode[], key: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aValue: any, bValue: any;

      // Handle nested properties based on key
      switch (key) {
        case 'name':
          aValue = `${a.name.firstName} ${a.name.lastName}`;
          bValue = `${b.name.firstName} ${b.name.lastName}`;
          break;
        case 'startDate':
          aValue = a.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt || '';
          bValue = b.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt || '';
          break;
        case 'candidateStatus':
          aValue = a.candidates?.edges[0]?.node?.status || '';
          bValue = b.candidates?.edges[0]?.node?.status || '';
          break;
        case 'status':
          aValue = a.candidates?.edges[0]?.node?.candConversationStatus || '';
          bValue = b.candidates?.edges[0]?.node?.candConversationStatus || '';
          break;
        default:
          aValue = (a as any)[key] || '';
          bValue = (b as any)[key] || '';
      }

      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    const sortedData = sortData(tableData, key, direction);
    setTableData(sortedData);
  };

  const getUnreadCount = (individualId: string) => {
    const unreadInfo = unreadMessages.listOfUnreadMessages.find(
      (item) => item.candidateId === individualId
    );
    return unreadInfo ? unreadInfo.ManyUnreadMessages.length : 0;
  };
  const handleDragEnd = (result: any) => {
    console.log("fradg gend result:",result)
    if (!result.destination) return;
    const items = Array.from(tableData);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    console.log("items:",items)
    setTableData(items);
    onReorder?.(items);
  };


  const sortedIndividuals = sortConfig.key && sortConfig.direction
    ? sortData(individuals, sortConfig.key, sortConfig.direction)
    : individuals;

    console.log("isAttachmentPanelOpen:",isAttachmentPanelOpen)
    console.log("isChatOpen:",isChatOpen)
    console.log("value of selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen:",selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen))

  return (
    <>
      <TableContainer>
      <DragDropContext onDragEnd={handleDragEnd}>

        <StyledTable>
          <StyledTableHeader>
            <tr>
              <StyledTableHeaderCell as="th" isSorted={false}>
                <Checkbox type="checkbox" checked={selectedIds.length === individuals.length} onChange={handleSelectAll} />
              </StyledTableHeaderCell>
              {[
                { key: 'name', label: 'Name' },
                { key: 'candidateStatus', label: 'Candidate Status' },
                { key: 'startDate', label: 'Start Date' },
                { key: 'status', label: 'Status' },
                { key: 'salary', label: 'Salary' },
                { key: 'city', label: 'City' },
                { key: 'jobTitle', label: 'Job Title' },
              ].map(({ key, label }) => (
                <StyledTableHeaderCell key={key} onClick={() => handleSort(key)} isSorted={sortConfig.key === key}>
                  <HeaderContent>
                    {label}
                    <SortIconsContainer>
                      <SortIcon isActive={sortConfig.key === key && sortConfig.direction === 'asc'}>
                        <IconChevronUp size={14} />
                      </SortIcon>
                      <SortIcon isActive={sortConfig.key === key && sortConfig.direction === 'desc'}>
                        <IconChevronDown size={14} />
                      </SortIcon>
                    </SortIconsContainer>
                  </HeaderContent>
                </StyledTableHeaderCell>
              ))}
            </tr>
          </StyledTableHeader>
          {/* <StyledTableBody>
            {sortedIndividuals.map((individual: frontChatTypes.PersonNode) => {
              const unreadCount = getUnreadCount(individual?.id);
              return (
                <StyledTableRow key={individual.id} $selected={selectedIndividual === individual?.id} onClick={() => onIndividualSelect(individual?.id)}>
                  <CheckboxCell onClick={e => e.stopPropagation()}>
                    <Checkbox type="checkbox" checked={selectedIds.includes(individual.id)} onChange={e => handleCheckboxChange(individual.id, e)} />
                  </CheckboxCell>
                  <StyledTableCell>
                    <NameCell>
                      {`${individual.name.firstName} ${individual.name.lastName}`}
                      {unreadCount > 0 && <UnreadIndicator>{unreadCount}</UnreadIndicator>}
                    </NameCell>
                  </StyledTableCell>
                  <StyledTableCell>{individual.candidates?.edges[0]?.node?.candConversationStatus || 'N/A'}</StyledTableCell>
                  <StyledTableCell>
                    { individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt
                      ? new Date(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', })
                      : 'N/A'
                    }
                  </StyledTableCell>
                  <StyledTableCell>{individual.candidates?.edges[0]?.node?.status || 'N/A'}</StyledTableCell>
                  <StyledTableCell>{individual.salary || 'N/A'}</StyledTableCell>
                  <StyledTableCell>{individual.city || 'N/A'}</StyledTableCell>
                  <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
                </StyledTableRow>
              );
            })}
          </StyledTableBody> */}
            <Droppable droppableId="chat-table-rows">
              {(provided) => (
                <StyledTableBody
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {tableData.map((individual, index) => (
                    <DraggableTableRow
                      key={individual.id}
                      individual={individual}
                      index={index}
                      selectedIndividual={selectedIndividual}
                      selectedIds={selectedIds}
                      handleCheckboxChange={handleCheckboxChange}
                      onIndividualSelect={onIndividualSelect}
                      getUnreadCount={getUnreadCount}
                    />
                  ))}
                  {provided.placeholder}
                </StyledTableBody>
              )}
            </Droppable>
        </StyledTable>
        </DragDropContext>

      </TableContainer>
      <ActionsBar data-visible={selectedIds.length > 0}>
        <SelectedCount>
          <IconUsers size={20} />
          {selectedIds.length} {selectedIds.length === 1 ? 'person' : 'people'} selected
          <CloseButton onClick={clearSelection}>
            <IconX size={20} />
          </CloseButton>
        </SelectedCount>

        <ActionButtons>
          {/* <ActionButton className="primary" onClick={handleViewChats} disabled={selectedIds.length === 0}>
            <IconMessages size={20} />
            View Chats
          </ActionButton> */}
          <Button
            Icon={IconMessages}
            variant="primary"
            accent="blue"
            title="View Chats"
            onClick={() => {
              handleViewChats();
              enqueueSnackBar('Opened Chats', {
                variant: SnackBarVariant.Success,
                icon: <IconCopy size={theme.icon.size.md} />,
                duration: 2000,
              });
            }}
          />
          <Button
            Icon={IconFileText}
            variant="primary"
            accent="blue"
            title="View Chats"
            onClick={() => {
              handleViewCVs();
              enqueueSnackBar('Opened CVs', {
                variant: SnackBarVariant.Success,
                icon: <IconCopy size={theme.icon.size.md} />,
                duration: 2000,
              });
            }}
          />


          {/* <ActionButton className="primary" onClick={handleViewCVs}>
            <IconFileText size={20} />
            View CVs
          </ActionButton> */}

          {/* <ActionButton 
              className="secondary"
              onClick={() => onBulkAssign?.(selectedIds)}
            >
              <IconUsers size={20} />
              Assign
            </ActionButton>
            
            <ActionButton 
              className="primary"
              onClick={() => onBulkMessage?.(selectedIds)}
            >
              <IconSend size={20} />
              Message
            </ActionButton> */}

          {/* <ActionButton className="danger" onClick={() => onBulkDelete?.(selectedIds)}>
            <IconTrash size={20} />
            Delete
          </ActionButton> */}
        </ActionButtons>
      </ActionsBar>
      <MultiCandidateChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} selectedPeople={selectedPeople} />
      {isAttachmentPanelOpen && currentCandidate && (
        <>
          <AttachmentPanel
            isOpen={isAttachmentPanelOpen}
            onClose={() => setIsAttachmentPanelOpen(false)}
            candidateId={currentCandidate.candidates.edges[0].node.id}
            candidateName={`${currentCandidate.name.firstName} ${currentCandidate.name.lastName}`}
            PanelContainer={PanelContainer} // Pass the styled component to override default positioning
          />

          {selectedIds.length > 1 && (isAttachmentPanelOpen || isChatOpen) && (
            <CandidateNavigation>
              <NavIconButton onClick={handlePrevCandidate} disabled={currentCandidateIndex === 0} title="Previous Candidate">
          <IconChevronLeft size={20} />
              </NavIconButton>

              <NavIconButton onClick={handleNextCandidate} disabled={currentCandidateIndex === selectedIds.length - 1} title="Next Candidate">
          <IconChevronRight size={20} />
              </NavIconButton>
            </CandidateNavigation>
          )}
        </>
      )}
    </>
  );
};

export default ChatTable;