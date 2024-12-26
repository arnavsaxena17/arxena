import React from 'react';
import styled from '@emotion/styled';

const TopbarContainer = styled.div`
  background-color: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  width: 100%;
  
  @media (max-width: 1024px) {
    padding: 6px;
  }
  
  @media (max-width: 768px) {
    padding: 4px;
  }
`;

const TopbarContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
`;

const FieldsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;
  
  @media (max-width: 1024px) {
    gap: 12px;
    font-size: 13px;
  }
  
  @media (max-width: 768px) {
    gap: 8px;
    font-size: 12px;
  }
`;

const AdditionalInfoAndButtons = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  
  @media (max-width: 1024px) {
    gap: 16px;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
  }
`;

const AdditionalInfo = styled.div`
  font-size: 12px;
  color: #4b5563;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  
  @media (max-width: 1024px) {
    font-size: 11px;
    gap: 6px;
  }
  
  @media (max-width: 768px) {
    font-size: 10px;
    gap: 4px;
    width: 100%;
  }
`;


const CopyableField = styled.span`
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
  
  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 1024px) {
    max-width: 200px;
  }
  
  @media (max-width: 768px) {
    max-width: 150px;
  }
`;


const MainInfo = styled.div`
  flex: 1;
`;

const StyledTopBar = styled.div`
  padding: 1.5rem;
  position: fixed;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 60%;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  z-index: 1;
  backdrop-filter: saturate(180%) blur(10px);
  flex-wrap: wrap;
  gap: 12px;
  
  @media (max-width: 1024px) {
    padding: 1rem;
    width: 75vw;
  }
  
  @media (max-width: 768px) {
    padding: 0.75rem;
    width: 90vw;
  }
`;

const EditableField = styled.span<{ isEditing: boolean }>`
  cursor: ${props => props.isEditing ? 'text' : 'pointer'};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
  
  &:hover {
    text-decoration: ${props => props.isEditing ? 'none' : 'underline'};
  }
  
  input {
    max-width: 120px;
    padding: 2px 4px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: inherit;
  }
  
  @media (max-width: 768px) {
    max-width: 100px;
    
    input {
      max-width: 80px;
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: nowrap;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const StyledSelect = styled.select`
  padding: 0.5em;
  margin-right: 1em;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  
  @media (max-width: 768px) {
    padding: 0.3em;
    margin-right: 0.5em;
    font-size: 12px;
  }
`;

const SeparatorDot = styled.span`
  margin: 0 4px;
  
  @media (max-width: 768px) {
    margin: 0 2px;
  }
`;

// Update the AdditionalInfo content to use dots instead of pipes for better responsive design
const AdditionalInfoContent: React.FC<{
  messageCount: number;
  jobName: string;
  salary: string;
  city: string;
  isEditingSalary: boolean;
  isEditingCity: boolean;
  onSalaryEdit: () => void;
  onCityEdit: () => void;
  onSalaryUpdate: () => void;
  onCityUpdate: () => void;
  setSalary: (value: string) => void;
  setCity: (value: string) => void;
}> = ({
  messageCount,
  jobName,
  salary,
  city,
  isEditingSalary,
  isEditingCity,
  onSalaryEdit,
  onCityEdit,
  onSalaryUpdate,
  onCityUpdate,
  setSalary,
  setCity,
}) => (
  <>
    Messages: {messageCount}
    <SeparatorDot>•</SeparatorDot>
    Current Job: {jobName || 'N/A'}
    <SeparatorDot>•</SeparatorDot>
    <EditableField isEditing={isEditingSalary} onDoubleClick={onSalaryEdit}>
      {isEditingSalary ? (
        <input
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          onBlur={onSalaryUpdate}
          onKeyPress={(e) => e.key === 'Enter' && onSalaryUpdate()}
          autoFocus
        />
      ) : (
        `Salary: ${salary || 'N/A'}`
      )}
    </EditableField>
    <SeparatorDot>•</SeparatorDot>
    <EditableField isEditing={isEditingCity} onDoubleClick={onCityEdit}>
      {isEditingCity ? (
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onBlur={onCityUpdate}
          onKeyPress={(e) => e.key === 'Enter' && onCityUpdate()}
          autoFocus
        />
      ) : (
        `City: ${city || 'N/A'}`
      )}
    </EditableField>
  </>
);

export {
  TopbarContainer,
  FieldsContainer,
  AdditionalInfo,
  CopyableField,
  StyledTopBar,
  EditableField,
  ButtonGroup,
  MainInfo,
  StyledSelect,
  AdditionalInfoAndButtons,
  AdditionalInfoContent,
};