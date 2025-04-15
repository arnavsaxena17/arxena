import styled from '@emotion/styled';
import { ReactNode } from 'react';
import { Button, IconDatabase, IconMail, IconRefresh, IconSearch, IconVideo } from 'twenty-ui';

type TopBarProps = {
  className?: string;
  leftComponent?: ReactNode;
  rightComponent?: ReactNode;
  bottomComponent?: ReactNode;
  displayBottomBorder?: boolean;
  showRefetch?:boolean;
  handleRefresh?: () => void;
  showVideoInterviewEdit?:boolean;
  handleVideoInterviewEdit?: () => void;
};

const StyledContainer = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.border.color.light}`};
  display: flex;
  margin-left: ${({ theme }) => theme.spacing(2)};

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

const StyledButtonContainer = styled.div`
display: flex;
gap: ${({ theme }) => theme.spacing(1)};
margin-left: ${({ theme }) => theme.spacing(2)};
`;

// const showRefetch = true;




export const TopBar = ({
  className,
  leftComponent,
  rightComponent,
  bottomComponent,
  handleRefresh,
  handleVideoInterviewEdit,
  showRefetch=true,
  showVideoInterviewEdit=true
}: TopBarProps) => (
  <StyledContainer className={className}>
    <StyledTopBar>
      <StyledLeftSection>{leftComponent}</StyledLeftSection>

      <StyledButtonContainer>
        {showRefetch && (
          <Button
            Icon={IconSearch}
            title="Sourcing"
            variant="secondary"
            accent="default"
            onClick={handleRefresh}
          />
        )}
        {showRefetch && (
          <Button
            Icon={IconMail}
            title="Engagement" 
            variant="secondary"
            accent="default"
            onClick={handleRefresh}
          />
        )}
        {showRefetch && (
          <Button
            Icon={IconDatabase}
            title="Enrichment" 
            variant="secondary"
            accent="default"
            onClick={handleRefresh}
          />
        )}
        {showRefetch && (
          <Button
            Icon={IconRefresh}
            title="Refetch"
            variant="secondary"
            accent="default"
            onClick={handleRefresh}
          />
        )}
        {showVideoInterviewEdit && (
          <Button
            Icon={IconVideo}
            title="Video Interviews"
            variant="secondary"
            accent="default"
            onClick={handleVideoInterviewEdit}
          />
        )}
      </StyledButtonContainer>

      <StyledRightSection>{rightComponent}</StyledRightSection>
    </StyledTopBar>
    {bottomComponent}
  </StyledContainer>
);
