import { IconHierarchy2 } from 'twenty-ui/icons';
import styled from '@emotion/styled';

import { SignInBackgroundOrgChartMock } from '@/sign-in-background-mock/components/SignInBackgroundOrgChartMock';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { PageHotkeysEffect } from '@/ui/layout/page/components/PageHotkeysEffect';

const StyledDiagramOuter = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

export const SignInBackgroundOrgChartMockPage = () => {
  return (
    <PageContainer>
      <PageHeader title="AI guessed Org Chart" Icon={IconHierarchy2}>
        <PageHotkeysEffect onAddButtonClick={() => {}} />
      </PageHeader>
      <PageBody>
        <StyledDiagramOuter>
          <SignInBackgroundOrgChartMock />
        </StyledDiagramOuter>
      </PageBody>
    </PageContainer>
  );
};
