import styled from '@emotion/styled';
import { IconBuildingSkyscraper } from 'twenty-ui';

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

/** Set to `false` to use the companies table mock instead of the Salesforce-style org chart. */
const SIGN_IN_BACKGROUND_USE_ORG_CHART_MOCK = true;

export const SignInBackgroundMockPage = () => {
  if (SIGN_IN_BACKGROUND_USE_ORG_CHART_MOCK) {
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
