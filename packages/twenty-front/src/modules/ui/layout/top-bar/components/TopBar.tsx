import { Button } from '@/ui/input/button/components/Button';
import styled from '@emotion/styled';
import { ReactNode } from 'react';
import { IconRefresh } from 'twenty-ui';

type TopBarProps = {
  className?: string;
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  bottomComponent?: ReactNode;
  displayBottomBorder?: boolean;
  showRefetch?:boolean;
  handleRefresh?: () => void;

};

const StyledContainer = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  display: flex;

  flex-direction: column;
`;

const StyledTopBar = styled.div`
  align-items: center;
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: row;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  height: 39px;
  justify-content: space-between;
  padding-right: ${({ theme }) => theme.spacing(2)};
  padding-left: ${({ theme }) => theme.spacing(2)};

  z-index: 7;
`;

const StyledLeftSection = styled.div`
  display: flex;
`;

const StyledRightSection = styled.div`
  display: flex;
  font-weight: ${({ theme }) => theme.font.weight.regular};
  gap: ${({ theme }) => theme.betweenSiblingsGap};
`;

export const TopBar = ({ className, leftComponent, rightComponent, bottomComponent, handleRefresh, displayBottomBorder = true, showRefetch=true }: TopBarProps) => (
  <StyledContainer className={className}>
    <StyledTopBar>
      <StyledLeftSection>{leftComponent}</StyledLeftSection>
      {showRefetch && (
        <Button
          Icon={IconRefresh}
          title="Refetch"
          variant="secondary"
          accent="default"
          onClick={handleRefresh}
        />
      )}

      <StyledRightSection>{rightComponent}</StyledRightSection>
    </StyledTopBar>
    {bottomComponent}
  </StyledContainer>
);
