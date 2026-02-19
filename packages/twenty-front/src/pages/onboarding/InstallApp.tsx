import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import styled from '@emotion/styled';
import { Trans } from '@lingui/react/macro';
import { ActionLink } from 'twenty-ui';

const StyledContentContainer = styled.div`
  width: 100%;
`;

const StyledSectionContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledButtonContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
  margin-left: auto;
  margin-right: auto;
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSkipContainer = styled.div`
  margin: ${({ theme }) => theme.spacing(3)} 0 0;
  display: flex;
  justify-content: center;
`;

export const InstallApp = () => {
  return (
    <>
      <Title noMarginTop>
        <Trans>Install Arxena App</Trans>
      </Title>
      <SubTitle />
      <StyledContentContainer>
        <StyledSectionContainer>
          <StyledButtonContainer />
        </StyledSectionContainer>
      </StyledContentContainer>
      <StyledSkipContainer>
        <ActionLink>
          <Trans>Skip</Trans>
        </ActionLink>
      </StyledSkipContainer>
    </>
  );
};
