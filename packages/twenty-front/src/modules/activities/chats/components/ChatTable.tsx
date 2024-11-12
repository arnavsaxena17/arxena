import React from 'react';
import styled from "@emotion/styled";
import * as frontChatTypes from "../types/front-chat-types";



const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  white-space: nowrap; 
  text-overflow: ellipsis
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
  // vertical-align: middle;
  width: 150px; // Set width for each cell

  @media (max-width: 768px) {
    // display: flex;
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
const StyledTableHeaderCell = styled.div`
  display: table-cell;
  padding: 1rem;
  font-weight: 600;
  text-align: left;
  border-bottom: 2px solid #e0e0e0;
`;


const StyledTableBody = styled.div`
  display: table-row-group;
  
  @media (max-width: 768px) {
    display: block;
  }
`;


const StyledTableHeader = styled.div`
  display: table-header-group;
  background-color: #f0f0f0;
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


const ChatTable: React.FC<frontChatTypes.ChatTableProps> = ({
  individuals,
  selectedIndividual,
  unreadMessages,
  onIndividualSelect,
}) => {

  const getUnreadCount = (individualId: string) => {
    const unreadInfo = unreadMessages.listOfUnreadMessages.find(
      (item) => item.candidateId === individualId
    );
    return unreadInfo ? unreadInfo.ManyUnreadMessages.length : 0;
  };
  
  
  return (
    <TableContainer>

    <StyledTable>
      <StyledTableHeader>
        <tr>
          <StyledTableHeaderCell>Name</StyledTableHeaderCell>
          <StyledTableHeaderCell>Last Message</StyledTableHeaderCell>
          <StyledTableHeaderCell>Status</StyledTableHeaderCell>
          <StyledTableHeaderCell>Salary</StyledTableHeaderCell>
          <StyledTableHeaderCell>City</StyledTableHeaderCell>
          <StyledTableHeaderCell>Job Title</StyledTableHeaderCell>
        </tr>
      </StyledTableHeader>
      <StyledTableBody>
        {individuals.map((individual: frontChatTypes.PersonNode) => {
          const unreadCount = getUnreadCount(individual.id);
          return (
            <StyledTableRow key={individual.id} $selected={selectedIndividual === individual.id} onClick={() => onIndividualSelect(individual.id)} >
              <StyledTableCell>
                <NameCell> {`${individual.name.firstName} ${individual.name.lastName}`} {unreadCount > 0 && ( <UnreadIndicator>{unreadCount}</UnreadIndicator> )} </NameCell>
              </StyledTableCell>
              <StyledTableCell>{individual.candidates.edges[0].node.whatsappMessages.edges[0].node.createdAt || 'N/A'}</StyledTableCell>
              <StyledTableCell>{individual.candidates?.edges[0]?.node?.status || 'N/A'}</StyledTableCell>
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