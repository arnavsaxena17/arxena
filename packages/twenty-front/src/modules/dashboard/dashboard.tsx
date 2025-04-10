import styled from '@emotion/styled';

import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageTitle } from '@/video-interview/interview-response/StyledComponentsInterviewResponse';

// Use the correct available states
import { RecordIndexLoadBaseOnContextStoreEffect } from '@/object-record/record-index/components/RecordIndexLoadBaseOnContextStoreEffect';

const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

// Main component
const CustomLayoutMerged = () => {
  // const candidateViewID = '29f46927-c997-47b9-978f-2e4f924c6ec1';

  return (
    <PageContainer>


      <PageTitle title="Jobs & Candidates" />
      <RecordIndexPageHeader />
      {/* <PageBody>
        <StyledIndexContainer>
          <RecordIndexContainerContextStoreNumberOfSelectedRecordsEffect />
          <RecordIndexContainer />
        </StyledIndexContainer>
      </PageBody> */}
      <RecordIndexLoadBaseOnContextStoreEffect />
    </PageContainer>
  );
};

export default CustomLayoutMerged;