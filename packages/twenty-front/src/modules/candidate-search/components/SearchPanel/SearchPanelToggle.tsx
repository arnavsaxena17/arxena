import { IconSearch } from 'twenty-ui/icons';
import { isSearchPanelOpenState } from '@/candidate-search/states/searchPanelState';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';

const StyledToggleButton = styled.button<{ isOpen: boolean }>`
  position: fixed;
  top: 50%;
  left: ${({ isOpen }) => isOpen ? '350px' : '0px'};
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-left: none;
  border-radius: 0 ${({ theme }) => theme.border.radius.md} ${({ theme }) => theme.border.radius.md} 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  transition: left 300ms ease;
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  
  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.medium};
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
  const [isOpen, setIsOpen] = useRecoilState(isSearchPanelOpenState);

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
