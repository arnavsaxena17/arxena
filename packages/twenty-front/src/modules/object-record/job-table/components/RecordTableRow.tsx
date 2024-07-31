import { useContext } from 'react';
import { useInView } from 'react-intersection-observer';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { Draggable } from '@hello-pangea/dnd';
import { useRecoilValue } from 'recoil';

import { getBasePathToShowPage } from '@/object-metadata/utils/getBasePathToShowPage';
import { RecordValueSetterEffect } from '@/object-record/record-store/components/RecordValueSetterEffect';
import { RecordTableCellFieldContextWrapper } from '@/object-record/job-table/components/RecordTableCellFieldContextWrapper';
import { RecordTableCellContext } from '@/object-record/job-table/contexts/RecordTableCellContext';
import { RecordTableContext } from '@/object-record/job-table/contexts/RecordTableContext';
import { RecordTableRowContext } from '@/object-record/job-table/contexts/RecordTableRowContext';
import { useRecordTableStates } from '@/object-record/job-table/hooks/internal/useRecordTableStates';
import { ScrollWrapperContext } from '@/ui/utilities/scroll/components/ScrollWrapper';

import { CheckboxCell } from './CheckboxCell';
import { GripCell } from './GripCell';

type RecordTableRowProps = {
  recordId: string;
  rowIndex: number;
  isPendingRow?: boolean;
};

const StyledTd = styled.td`
  position: relative;
  user-select: none;
`;

const StyledTr = styled.tr<{ isDragging: boolean }>`
  border: 1px solid transparent;
  transition: border-left-color 0.2s ease-in-out;

  td:nth-of-type(-n + 2) {
    background-color: ${({ theme }) => theme.background.primary};
    border-right-color: ${({ theme }) => theme.background.primary};
  }

  ${({ isDragging }) =>
    isDragging &&
    `
    td:nth-of-type(1) {
      background-color: transparent;
      border-color: transparent;
    }

    td:nth-of-type(2) {
      background-color: transparent;
      border-color: transparent;
    }

    td:nth-of-type(3) {
      background-color: transparent;
      border-color: transparent;
    }

  `}
`;

export const RecordTableRow = ({ recordId, rowIndex, isPendingRow }: RecordTableRowProps) => {
  const { visibleTableColumnsSelector, isRowSelectedFamilyState } = useRecordTableStates();
  const currentRowSelected = useRecoilValue(isRowSelectedFamilyState(recordId));
  const { objectMetadataItem } = useContext(RecordTableContext);

  // const visibleTableColumns = useRecoilValue(visibleTableColumnsSelector());

  const visibleTableColumns = [
    {
      fieldMetadataId: '4555f4bc-1419-4048-b9cc-e51bd6da16ff',
      label: 'Name',
      metadata: {
        fieldName: 'name',
        placeHolder: 'Name',
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'IconAbc',
      type: 'TEXT',
      position: 0,
      size: 180,
      isLabelIdentifier: true,
      isVisible: true,
      viewFieldId: '2e04f53d-0b83-432d-a76e-607a090bf506',
      isSortable: true,
      isFilterable: true,
      defaultValue: "'Untitled'",
    },
    {
      fieldMetadataId: '84aea15c-1bc7-4c10-8ad7-c0fb17827f2d',
      label: 'Creation date',
      metadata: {
        fieldName: 'createdAt',
        placeHolder: 'Creation date',
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'IconCalendar',
      type: 'DATE_TIME',
      position: 1,
      size: 180,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: '3da431ae-9895-410e-b6bd-f73a6b1cf179',
      isSortable: true,
      isFilterable: true,
      defaultValue: 'now',
    },
    {
      fieldMetadataId: '0a80440d-7ea7-4c88-93cf-1973a083eba7',
      label: 'isActive',
      metadata: {
        fieldName: 'isActive',
        placeHolder: 'isActive',
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'Icon123',
      type: 'BOOLEAN',
      position: 4,
      size: 180,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: 'b6a18195-26ff-43c1-b6ab-037405ed053d',
      isSortable: true,
      isFilterable: false,
      defaultValue: null,
    },
    {
      fieldMetadataId: '76af1771-15c3-457e-b18f-077c22c5fb50',
      label: 'jobLocation',
      metadata: {
        fieldName: 'jobLocation',
        placeHolder: 'jobLocation',
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'Icon123',
      type: 'TEXT',
      position: 5,
      size: 180,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: '7e39851d-1a6e-46ef-be77-2a73e1985063',
      isSortable: true,
      isFilterable: true,
      defaultValue: "''",
    },
    {
      fieldMetadataId: '31c64bcc-7182-46cc-9c40-1ebba7e711cd',
      label: 'Arxena Job Id',
      metadata: {
        fieldName: 'arxenaSiteId',
        placeHolder: 'Arxena Job Id',
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'Icon123',
      type: 'TEXT',
      position: 6,
      size: 180,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: '25675d87-fc85-442a-b060-087d9f610460',
      isSortable: true,
      isFilterable: true,
      defaultValue: "''",
    },
    {
      fieldMetadataId: '9fd70af8-5eb6-42b0-89a0-28ba1165bbe9',
      label: 'Object Metadata Id',
      metadata: {
        fieldName: 'objectMetadataId',
        placeHolder: 'Object Metadata Id',
        relationObjectMetadataNameSingular: '',
        relationObjectMetadataNamePlural: '',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: '',
        options: null,
      },
      iconName: 'Icon123',
      type: 'TEXT',
      position: 7,
      size: 180,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: '794d671d-8675-4bae-9186-8b764c6cc733',
      isSortable: true,
      isFilterable: true,
      defaultValue: "''",
    },
    {
      fieldMetadataId: '946df28a-0d05-4bb8-b16c-dd571c731cce',
      label: 'Recruiter',
      metadata: {
        fieldName: 'recruiter',
        placeHolder: 'Recruiter',
        relationType: 'TO_ONE_OBJECT',
        relationFieldMetadataId: '039f0573-a188-40ca-80cb-3682ecdd21e3',
        relationObjectMetadataNameSingular: 'workspaceMember',
        relationObjectMetadataNamePlural: 'workspaceMembers',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: 'jobs',
        options: null,
      },
      iconName: 'Icon123',
      type: 'RELATION',
      position: 8,
      size: 100,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: 'e6d1aea5-480c-48e7-b8c2-a7b65a7f04ff',
      isSortable: false,
      isFilterable: true,
      defaultValue: null,
    },
    {
      fieldMetadataId: 'fdb53ac7-594e-45c8-82b9-f1aafeda71fc',
      label: 'Companies',
      metadata: {
        fieldName: 'companies',
        placeHolder: 'Companies',
        relationType: 'TO_ONE_OBJECT',
        relationFieldMetadataId: '56d0a8eb-e1b3-4e4d-b42a-b39a41942420',
        relationObjectMetadataNameSingular: 'company',
        relationObjectMetadataNamePlural: 'companies',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: 'jobs',
        options: null,
      },
      iconName: 'Icon123',
      type: 'RELATION',
      position: 9,
      size: 100,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: '50cb0741-a5bb-4ece-bf89-1b2d6c8b6ea2',
      isSortable: false,
      isFilterable: true,
      defaultValue: null,
    },
    {
      fieldMetadataId: 'f83ca940-fc5b-4b29-ba04-824b4c658a9e',
      label: 'ClientContact',
      metadata: {
        fieldName: 'clientContacts',
        placeHolder: 'ClientContact',
        relationType: 'TO_ONE_OBJECT',
        relationFieldMetadataId: '31ebe5db-38fe-4e07-abc2-68a87c9ccc25',
        relationObjectMetadataNameSingular: 'clientContact',
        relationObjectMetadataNamePlural: 'clientContacts',
        objectMetadataNameSingular: 'job',
        targetFieldMetadataName: 'jobs',
        options: null,
      },
      iconName: 'Icon123',
      type: 'RELATION',
      position: 10,
      size: 100,
      isLabelIdentifier: false,
      isVisible: true,
      viewFieldId: 'c96a180f-3273-42f8-92f7-4b69198957e8',
      isSortable: false,
      isFilterable: true,
      defaultValue: null,
    },
  ];

  console.log('RecordTableRow', recordId, rowIndex, isPendingRow, visibleTableColumns, currentRowSelected, objectMetadataItem);

  const scrollWrapperRef = useContext(ScrollWrapperContext);

  const { ref: elementRef, inView } = useInView({
    root: scrollWrapperRef.current?.querySelector('[data-overlayscrollbars-viewport="scrollbarHidden"]'),
    rootMargin: '1000px',
  });

  const theme = useTheme();

  return (
    <RecordTableRowContext.Provider
      value={{
        recordId,
        rowIndex,
        pathToShowPage:
          getBasePathToShowPage({
            objectNameSingular: objectMetadataItem.nameSingular,
          }) + recordId,
        objectNameSingular: objectMetadataItem.nameSingular,
        isSelected: currentRowSelected,
        isReadOnly: objectMetadataItem.isRemote ?? false,
        isPendingRow,
      }}>
      <RecordValueSetterEffect recordId={recordId} />

      <Draggable key={recordId} draggableId={recordId} index={rowIndex}>
        {(draggableProvided, draggableSnapshot) => (
          <StyledTr
            ref={node => {
              elementRef(node);
              draggableProvided.innerRef(node);
            }}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...draggableProvided.draggableProps}
            style={{
              ...draggableProvided.draggableProps.style,
              background: draggableSnapshot.isDragging ? theme.background.transparent.light : 'none',
              borderColor: draggableSnapshot.isDragging ? `${theme.border.color.medium}` : 'transparent',
            }}
            isDragging={draggableSnapshot.isDragging}
            data-testid={`row-id-${recordId}`}
            data-selectable-id={recordId}>
            <StyledTd
              // eslint-disable-next-line react/jsx-props-no-spreading
              {...draggableProvided.dragHandleProps}
              data-select-disable>
              <GripCell isDragging={draggableSnapshot.isDragging} />
            </StyledTd>
            <StyledTd>{!draggableSnapshot.isDragging && <CheckboxCell />}</StyledTd>
            {inView || draggableSnapshot.isDragging
              ? visibleTableColumns.map((column, columnIndex) => (
                  <RecordTableCellContext.Provider
                    value={{
                      //@ts-ignore
                      columnDefinition: column,
                      columnIndex,
                    }}
                    key={column.fieldMetadataId}>
                    {draggableSnapshot.isDragging && columnIndex > 0 ? null : <RecordTableCellFieldContextWrapper />}
                  </RecordTableCellContext.Provider>
                ))
              : visibleTableColumns.map(column => <StyledTd key={column.fieldMetadataId}></StyledTd>)}
            <StyledTd />
          </StyledTr>
        )}
      </Draggable>
    </RecordTableRowContext.Provider>
  );
};
