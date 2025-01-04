import { useParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { v4 } from 'uuid';
import { useRecoilValue } from 'recoil';

import { RecordIndexContainer } from '@/object-record/record-index/components/RecordIndexContainer';
import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
import { useRecordTable } from '@/object-record/record-table/hooks/useRecordTable';
import { DEFAULT_CELL_SCOPE } from '@/object-record/record-table/record-table-cell/hooks/useOpenRecordTableCell';
import { useSelectedTableCellEditMode } from '@/object-record/record-table/record-table-cell/hooks/useSelectedTableCellEditMode';
import { PageBody } from '@/ui/layout/page/PageBody';
import { PageContainer } from '@/ui/layout/page/PageContainer';
import { useSetHotkeyScope } from '@/ui/utilities/hotkey/hooks/useSetHotkeyScope';
import { PageTitle } from '@/ui/utilities/page-title/PageTitle';
import { capitalize } from '~/utils/string/capitalize';
import { ShowPageAddButton } from '@/ui/layout/show-page/components/ShowPageAddButton';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';


import { isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';
// import { InterviewCreationModal } from '@/ai-interview/interview-creation/InterviewCreationModal';
import { ArxEnrichmentModal } from '@/arx-enrich/arxEnrichmentModal';


const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;
console.log("CoreObjectNameSingular::", CoreObjectNameSingular)

export const RecordIndexPage = () => {
  const objectNamePlural = useParams().objectNamePlural ?? '';
  // const isAIInterviewModalOpen = useRecoilValue(isAIInterviewModalOpenState);
  const isArxEnrichModalOpen = useRecoilValue(isArxEnrichModalOpenState);
  

  const recordIndexId = objectNamePlural ?? '';
  const setHotkeyScope = useSetHotkeyScope();

  const { setSelectedTableCellEditMode } = useSelectedTableCellEditMode({
    scopeId: recordIndexId,
  });

  const { setPendingRecordId } = useRecordTable({
    recordTableId: recordIndexId,
  });

  const handleAddButtonClick = async () => {
    setPendingRecordId(v4());
    setSelectedTableCellEditMode(-1, 0);
    setHotkeyScope(DEFAULT_CELL_SCOPE.scope, DEFAULT_CELL_SCOPE.customScopes);
  };


  console.log("isArxEnrichModalOpen", isArxEnrichModalOpen)
  return (
    <PageContainer>
      <PageTitle title={`${capitalize(objectNamePlural)}`} />
      <RecordIndexPageHeader createRecord={handleAddButtonClick} />
      <PageBody>
        <StyledIndexContainer>
          <RecordIndexContainer
            recordIndexId={recordIndexId}
            objectNamePlural={objectNamePlural}
            createRecord={handleAddButtonClick}

          />
        
        {isArxEnrichModalOpen ? (
          <ArxEnrichmentModal
            objectNameSingular={objectNamePlural === 'companies' ? 'company' : objectNamePlural.slice(0, -1)}
            objectRecordId={'0'}

          />
        ) : (
          <></>)}

        </StyledIndexContainer>
      </PageBody>
    </PageContainer>
  );
};
