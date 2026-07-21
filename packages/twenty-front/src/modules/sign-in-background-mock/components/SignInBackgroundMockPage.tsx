import { IconBuildingSkyscraper } from 'twenty-ui/icons';
import { signInBackgroundUseOrgChartMockState } from '@/client-config/states/signInBackgroundUseOrgChartMockState';
import styled from '@emotion/styled';
import { useRecoilValue } from 'recoil';

import { RecordFieldValueSelectorContextProvider } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { SignInBackgroundMockContainer } from '@/sign-in-background-mock/components/SignInBackgroundMockContainer';
import { SignInBackgroundOrgChartMockPage } from '@/sign-in-background-mock/components/SignInBackgroundOrgChartMockPage';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { PageHotkeysEffect } from '@/ui/layout/page/components/PageHotkeysEffect';

const StyledTableContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

export const SignInBackgroundMockPage = () => {
  const signInBackgroundUseOrgChartMock = useRecoilValue(
    signInBackgroundUseOrgChartMockState,
  );

  if (signInBackgroundUseOrgChartMock) {
    return <SignInBackgroundOrgChartMockPage />;
  }

  return (
    <PageContainer>
      <PageHeader title="Companies" Icon={IconBuildingSkyscraper}>
        <PageHotkeysEffect onAddButtonClick={() => {}} />
        {/* <PageAddButton /> */}
      </PageHeader>
      <PageBody>
        <RecordFieldValueSelectorContextProvider>
          <StyledTableContainer>
            <SignInBackgroundMockContainer />
          </StyledTableContainer>
        </RecordFieldValueSelectorContextProvider>
      </PageBody>
    </PageContainer>
  );
};
