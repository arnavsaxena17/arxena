import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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
  position: fixed;
  top: 80px;
  right: ${props => (props.isOpen ? '0' : '-40%')};
  width: 40%;
  background-color: ${themeCssVariables.background.secondary};
  box-shadow: ${themeCssVariables.boxShadow.strong};
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
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  box-shadow: ${themeCssVariables.boxShadow.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background-color: ${themeCssVariables.background.tertiary};
    transform: scale(1.05);
    box-shadow: ${themeCssVariables.boxShadow.strong};
  }

  &:disabled {
    background-color: ${themeCssVariables.background.quaternary};
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
  }
`;
