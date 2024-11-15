import React, { useState } from 'react';
import styled from "@emotion/styled";
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import * as frontChatTypes from "../types/front-chat-types";

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
  padding: 1rem;
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
  padding: 1rem;
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

const StyledTableRow = styled.div<{ $selected: boolean }>`
  display: table-row;
  background-color: ${(props) => (props.$selected ? "#f5f9fd" : "white")};
  cursor: pointer;
  
  &:hover {
    background-color: ${(props) => (props.$selected ? "#f5f9fd" : "#f0f0f0")};
  }
  
  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    border-bottom: 1px solid #e0e0e0;
    position: relative;
  }
`;

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

interface SortConfig {
  key: string | null;
  direction: 'asc' | 'desc' | null;
}

const ChatTable: React.FC<frontChatTypes.ChatTableProps> = ({
  individuals,
  selectedIndividual,
  unreadMessages,
  onIndividualSelect,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: null
  });

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
          aValue = a.candidates?.edges[0]?.node?.statusCandidates || '';
          bValue = b.candidates?.edges[0]?.node?.statusCandidates || '';
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
  };

  const getUnreadCount = (individualId: string) => {
    const unreadInfo = unreadMessages.listOfUnreadMessages.find(
      (item) => item.candidateId === individualId
    );
    return unreadInfo ? unreadInfo.ManyUnreadMessages.length : 0;
  };

  const sortedIndividuals = sortConfig.key && sortConfig.direction
    ? sortData(individuals, sortConfig.key, sortConfig.direction)
    : individuals;

  return (
    <TableContainer>
      <StyledTable>
        <StyledTableHeader>
          <tr>
            {[
              { key: 'name', label: 'Name' },
              { key: 'startDate', label: 'Start Date' },
              { key: 'candidateStatus', label: 'Candidate Status' },
              { key: 'status', label: 'Status' },
              { key: 'salary', label: 'Salary' },
              { key: 'city', label: 'City' },
              { key: 'jobTitle', label: 'Job Title' }
            ].map(({ key, label }) => (
              <StyledTableHeaderCell
                key={key}
                onClick={() => handleSort(key)}
                isSorted={sortConfig.key === key}
              >
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
        <StyledTableBody>
          {sortedIndividuals.map((individual: frontChatTypes.PersonNode) => {
            const unreadCount = getUnreadCount(individual?.id);
            return (
              <StyledTableRow
                key={individual.id}
                $selected={selectedIndividual === individual?.id}
                onClick={() => onIndividualSelect(individual?.id)}
              >
                <StyledTableCell>
                  <NameCell>
                    {`${individual.name.firstName} ${individual.name.lastName}`}
                    {unreadCount > 0 && (
                      <UnreadIndicator>{unreadCount}</UnreadIndicator>
                    )}
                  </NameCell>
                </StyledTableCell>
                <StyledTableCell>
                  {individual?.candidates?.edges[0]?.node?.whatsappMessages?.edges[0]?.node?.createdAt
                    ? new Date(individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A'}
                </StyledTableCell>
                <StyledTableCell>{individual.candidates?.edges[0]?.node?.status || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.candidates?.edges[0]?.node?.statusCandidates || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.salary || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.city || 'N/A'}</StyledTableCell>
                <StyledTableCell>{individual.jobTitle || 'N/A'}</StyledTableCell>
              </StyledTableRow>
            );
          })}
        </StyledTableBody>
      </StyledTable>
    </TableContainer>
  );
};

export default ChatTable;