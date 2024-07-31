import { useParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { v4 } from 'uuid';

// import { RecordIndexContainer } from '@/object-record/record-index/components/RecordIndexContainer';
import { RecordIndexPageHeader } from '@/object-record/record-index/components/RecordIndexPageHeader';
import { useRecordTable } from '@/object-record/record-table/hooks/useRecordTable';
import { DEFAULT_CELL_SCOPE } from '@/object-record/record-table/record-table-cell/hooks/useOpenRecordTableCell';
import { useSelectedTableCellEditMode } from '@/object-record/record-table/record-table-cell/hooks/useSelectedTableCellEditMode';
import { PageBody } from '@/ui/layout/page/PageBody';
import { PageContainer } from '@/ui/layout/page/PageContainer';
import { useSetHotkeyScope } from '@/ui/utilities/hotkey/hooks/useSetHotkeyScope';
import { PageTitle } from '@/ui/utilities/page-title/PageTitle';
import { capitalize } from '~/utils/string/capitalize';
import { useRecordShowPage } from '@/object-record/record-show/hooks/useRecordShowPage';
import { RecordIndexContainer } from 'packages/twenty-front/src/modules/object-record/record-index/components/RecordIndexContainer';
import { RecordProvider, useRecordContext } from './RecordContext';
import { useProcessData } from './useProcessData';
import RecordProviderContainer from './RecordProviderContainer';

const StyledIndexContainer = styled.div`
  display: flex;
  height: 100%;
  width: 100%;
`;

export const RecordConsolidatedPage = () => {
  // const objectNamePlural = useParams().objectNamePlural ?? '';
  const objectNamePlural = 'Candidates';
  // console.log('objectNamePlural', useParams());
  // const recordIndexId = objectNamePlural ?? '';
  const setHotkeyScope = useSetHotkeyScope();

  const { setSelectedTableCellEditMode } = useSelectedTableCellEditMode({
    scopeId: '8f0ec4e8-1a8c-48f1-a89e-6b5d6267d4c1',
  });

  const { setPendingRecordId } = useRecordTable({
    recordTableId: '8f0ec4e8-1a8c-48f1-a89e-6b5d6267d4c1',
  });

  const handleAddButtonClick = async () => {
    setPendingRecordId(v4());
    setSelectedTableCellEditMode(-1, 0);
    setHotkeyScope(DEFAULT_CELL_SCOPE.scope, DEFAULT_CELL_SCOPE.customScopes);
  };

  const parameters = useParams<{
    // objectNameSingular: string;
    jobId: string;
  }>();

  console.log('parameters', parameters);

  // const { objectNameSingular, objectRecordId, headerIcon, loading, pageTitle, pageName, isFavorite, handleFavoriteButtonClick, record, objectMetadataItem } = useRecordShowPage('candidate' ?? '', parameters.jobId ?? '');

  const jobData = useRecordShowPage('job', parameters.jobId ?? '');

  console.log(jobData?.objectNameSingular, jobData?.objectRecordId, jobData?.headerIcon, jobData?.loading, jobData?.pageTitle, jobData?.pageName, jobData?.isFavorite, jobData?.handleFavoriteButtonClick, jobData?.record, jobData?.objectMetadataItem);

  // const processedRecordData = useProcessData(record, setColumns, setData)
  return (
    <RecordProvider>
      <RecordProviderContainer record={jobData?.record}>
        <PageContainer>
          <PageTitle title={`${capitalize(objectNamePlural)}`} />
          <RecordIndexPageHeader createRecord={handleAddButtonClick} />
          <PageBody>
            <StyledIndexContainer>
              {/* <RecordIndexContainer recordIndexId={recordIndexId} objectNamePlural={objectNamePlural} createRecord={handleAddButtonClick} /> */}
              <RecordIndexContainer recordIndexId="candidates" objectNamePlural="candidates" createRecord={handleAddButtonClick} isConsolidated={true} />
              {/* <h1>THIS IS JOB PAGE</h1> */}
            </StyledIndexContainer>
          </PageBody>
        </PageContainer>
      </RecordProviderContainer>
    </RecordProvider>
  );
};
