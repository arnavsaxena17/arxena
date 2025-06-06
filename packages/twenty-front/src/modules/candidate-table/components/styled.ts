import styled from '@emotion/styled';

export const TableContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: auto;
  white-space: nowrap;
  text-overflow: ellipsis;
  -webkit-overflow-scrolling: touch;
  position: relative;
  z-index: 10;

  .handsontable {
    overflow: visible;
    height: 100%;
  }

  .handsontable .ht_clone_top {
    z-index: 101;
  }

  .handsontable .wtHolder {
    overflow: auto;
  }

  @media (max-width: 768px) {
    margin: 0;
    padding: 0;
  }
`;

export const PanelContainer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 80px;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  background-color: #f5f5f5;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease-in-out;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
`;

export const CandidateNavigation = styled.div`
  position: fixed;
  top: 50%;
  right: 41%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 1001;
`;

export const NavIconButton = styled.button`
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