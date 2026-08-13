import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const TableContainer = styled.div`
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  position: relative;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  z-index: 10;
  .handsontable {
    height: 100%;
    overflow: visible;
  }
  .handsontable .ht_clone_top {
    z-index: 160;
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
  background-color: ${themeCssVariables.background.secondary};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: fixed;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  top: 80px;
  transition: right 0.3s ease-in-out;
  width: 40%;
  z-index: 1000;
`;
export const CandidateNavigation = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: fixed;
  right: 41%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1001;
`;

export const NavIconButton = styled.button`
  align-items: center;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 50%;
  box-shadow: ${themeCssVariables.boxShadow.light};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: 0.75rem;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background-color: ${themeCssVariables.background.tertiary};
    box-shadow: ${themeCssVariables.boxShadow.strong};
    transform: scale(1.05);
  }

  &:disabled {
    background-color: ${themeCssVariables.background.quaternary};
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
  }
`;
