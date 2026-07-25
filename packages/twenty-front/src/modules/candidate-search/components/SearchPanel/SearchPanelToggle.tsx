import { IconSearch } from 'twenty-ui/icon';
import { isSearchPanelOpenState } from '@/candidate-search/states/searchPanelState';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

const StyledToggleButton = styled.button<{ isOpen: boolean }>`
  position: fixed;
  top: 50%;
  left: ${({ isOpen }) => isOpen ? '350px' : '0px'};
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-left: none;
  border-radius: 0 ${themeCssVariables.border.radius.md} ${themeCssVariables.border.radius.md} 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  transition: left 300ms ease;
  box-shadow: ${themeCssVariables.boxShadow.light};
  
  &:hover {
    background-color: ${themeCssVariables.background.secondary};
    border-color: ${themeCssVariables.border.color.medium};
  }
  
  &:active {
    transform: translateY(-50%) scale(0.95);
  }
`;

const StyledIcon = styled.div<{ isOpen: boolean }>`
  transform: ${({ isOpen }) => isOpen ? 'rotate(3600deg)' : 'rotate(0deg)'};
  transition: transform 300ms ease;
`;

type SearchPanelToggleProps = {
  className?: string;
};

export const SearchPanelToggle = ({ className }: SearchPanelToggleProps) => {
  const [isOpen, setIsOpen] = useAtomState(isSearchPanelOpenState);

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  return (
    <StyledToggleButton
      className={className}
      isOpen={isOpen}
      onClick={togglePanel}
      title={isOpen ? 'Close search panel' : 'Open search panel'}
    >
      <StyledIcon isOpen={isOpen}>
        <IconSearch size={16} />
      </StyledIcon>
    </StyledToggleButton>
  );
};
