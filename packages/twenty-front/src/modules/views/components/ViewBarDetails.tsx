import { MutableRefObject, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import styled from '@emotion/styled';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import isEqual from 'lodash/isEqual';

import { AddObjectFilterFromDetailsButton } from '@/object-record/object-filter-dropdown/components/AddObjectFilterFromDetailsButton';
import { ObjectFilterDropdownScope } from '@/object-record/object-filter-dropdown/scopes/ObjectFilterDropdownScope';
import { DropdownScope } from '@/ui/layout/dropdown/scopes/DropdownScope';
import { EditableFilterDropdownButton } from '@/views/components/EditableFilterDropdownButton';
import { EditableSortChip } from '@/views/components/EditableSortChip';
import { ViewBarFilterEffect } from '@/views/components/ViewBarFilterEffect';
import { useViewFromQueryParams } from '@/views/hooks/internal/useViewFromQueryParams';
import { useViewStates } from '@/views/hooks/internal/useViewStates';
import { useGetCurrentView } from '@/views/hooks/useGetCurrentView';
import { useResetCurrentView } from '@/views/hooks/useResetCurrentView';
import { mapViewFiltersToFilters } from '@/views/utils/mapViewFiltersToFilters';
import { mapViewSortsToSorts } from '@/views/utils/mapViewSortsToSorts';
import { selector } from 'recoil';
import { currentViewWithFiltersState } from '../states/currentViewState';
import { unstable_batchedUpdates as ReactDOM_batchedUpdates } from 'react-dom';
import React from 'react';


export type ViewBarDetailsProps = {
  hasFilterButton?: boolean;
  rightComponent?: ReactNode;
  filterDropdownId?: string;
  viewBarId: string;
};





const StyledBar = styled.div`
  align-items: center;
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: row;
  min-height: 32px;
  justify-content: space-between;
  z-index: 4;
  padding-top: ${({ theme }) => theme.spacing(1)};
  padding-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledChipcontainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: row;
  gap: ${({ theme }) => theme.spacing(1)};
  min-height: 32px;
  margin-left: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

const StyledCancelButton = styled.button`
  background-color: inherit;
  border: none;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-left: auto;
  margin-right: ${({ theme }) => theme.spacing(2)};
  padding: ${(props) => {
    const horiz = props.theme.spacing(2);
    const vert = props.theme.spacing(1);
    return `${vert} ${horiz} ${vert} ${horiz}`;
  }};
  user-select: none;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    border-radius: ${({ theme }) => theme.spacing(1)};
  }
`;

const StyledFilterContainer = styled.div`
  align-items: center;
  display: flex;
`;

const StyledSeperatorContainer = styled.div`
  align-items: flex-start;
  align-self: stretch;
  display: flex;
  padding-bottom: ${({ theme }) => theme.spacing(2)};
  padding-left: ${({ theme }) => theme.spacing(1)};
  padding-right: ${({ theme }) => theme.spacing(1)};
  padding-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledSeperator = styled.div`
  align-self: stretch;
  background: ${({ theme }) => theme.background.quaternary};
  width: 1px;
`;

const StyledAddFilterContainer = styled.div`
  margin-left: ${({ theme }) => theme.spacing(1)};
  z-index: 5;
`;


// export const currentViewWithFiltersAndSortsSelector = selector({
//   key: 'currentViewWithFiltersAndSortsSelector',
//   get: ({ get }) => {
//     // Add your logic to access the current view data
//     const { currentViewWithCombinedFiltersAndSorts } = useGetCurrentView();
//     return currentViewWithCombinedFiltersAndSorts;
//   },
// });

export const ViewBarDetails = React.memo(({
  hasFilterButton = false,
  rightComponent,
  filterDropdownId,
}: ViewBarDetailsProps) => {
  const setCurrentViewWithFilters = useSetRecoilState(currentViewWithFiltersState);
  
  const {
    canPersistViewSelector,
    isViewBarExpandedState,
    availableFilterDefinitionsState,
    availableSortDefinitionsState,
  } = useViewStates();

  const { currentViewWithCombinedFiltersAndSorts } = useGetCurrentView();
  
  const isViewBarExpanded = useRecoilValue(isViewBarExpandedState);
  const { hasFiltersQueryParams } = useViewFromQueryParams();
  const canPersistView = useRecoilValue(canPersistViewSelector());
  const availableFilterDefinitions = useRecoilValue(availableFilterDefinitionsState);
  const availableSortDefinitions = useRecoilValue(availableSortDefinitionsState);
  const previousViewRef = useRef<typeof currentViewWithCombinedFiltersAndSorts | null>(null) as MutableRefObject<typeof currentViewWithCombinedFiltersAndSorts | null>;
  const { resetCurrentView } = useResetCurrentView();

  useEffect(() => {
    if (!currentViewWithCombinedFiltersAndSorts) return;

    const hasChanged = !isEqual(
      currentViewWithCombinedFiltersAndSorts, 
      previousViewRef.current
    );

    if (hasChanged) {
      previousViewRef.current = currentViewWithCombinedFiltersAndSorts;
      ReactDOM_batchedUpdates(() => {
        setCurrentViewWithFilters(currentViewWithCombinedFiltersAndSorts);
      });
    }
  }, [currentViewWithCombinedFiltersAndSorts, setCurrentViewWithFilters]);

  const handleCancelClick = useCallback(() => {
    resetCurrentView();
  }, [resetCurrentView]);

  const canResetView = useMemo(() => 
    canPersistView && !hasFiltersQueryParams
  , [canPersistView, hasFiltersQueryParams]);

  const shouldExpandViewBar = useMemo(() =>
    canPersistView ||
    ((currentViewWithCombinedFiltersAndSorts?.viewSorts?.length ||
      currentViewWithCombinedFiltersAndSorts?.viewFilters?.length) &&
      isViewBarExpanded)
  , [
    canPersistView,
    currentViewWithCombinedFiltersAndSorts?.viewSorts?.length,
    currentViewWithCombinedFiltersAndSorts?.viewFilters?.length,
    isViewBarExpanded
  ]);

  const mappedSorts = useMemo(() => 
    mapViewSortsToSorts(
      currentViewWithCombinedFiltersAndSorts?.viewSorts ?? [],
      availableSortDefinitions,
    )
  , [currentViewWithCombinedFiltersAndSorts?.viewSorts, availableSortDefinitions]);

  const mappedFilters = useMemo(() =>
    mapViewFiltersToFilters(
      currentViewWithCombinedFiltersAndSorts?.viewFilters ?? [],
      availableFilterDefinitions,
    )
  , [currentViewWithCombinedFiltersAndSorts?.viewFilters, availableFilterDefinitions]);

  const hasSortsAndFilters = useMemo(() => 
    !!currentViewWithCombinedFiltersAndSorts?.viewSorts?.length &&
    !!currentViewWithCombinedFiltersAndSorts?.viewFilters?.length
  , [
    currentViewWithCombinedFiltersAndSorts?.viewSorts?.length,
    currentViewWithCombinedFiltersAndSorts?.viewFilters?.length
  ]);

  if (!shouldExpandViewBar) {
    return null;
  }

  return (
    <StyledBar>
      <StyledFilterContainer>
        <StyledChipcontainer>
          {mappedSorts.map((sort) => (
            <EditableSortChip 
              key={sort.fieldMetadataId} 
              viewSort={sort} 
            />
          ))}
          
          {hasSortsAndFilters && (
            <StyledSeperatorContainer>
              <StyledSeperator />
            </StyledSeperatorContainer>
          )}

          {mappedFilters.map((viewFilter) => (
            <ObjectFilterDropdownScope
              key={viewFilter.id}
              filterScopeId={viewFilter.id}
            >
              <DropdownScope dropdownScopeId={viewFilter.id}>
                <ViewBarFilterEffect filterDropdownId={viewFilter.id} />
                <EditableFilterDropdownButton
                  viewFilter={viewFilter}
                  hotkeyScope={{
                    scope: viewFilter.id,
                  }}
                  viewFilterDropdownId={viewFilter.id}
                />
              </DropdownScope>
            </ObjectFilterDropdownScope>
          ))}
        </StyledChipcontainer>

        {hasFilterButton && (
          <StyledAddFilterContainer>
            <AddObjectFilterFromDetailsButton
              filterDropdownId={filterDropdownId}
            />
          </StyledAddFilterContainer>
        )}
      </StyledFilterContainer>

      {canResetView && (
        <StyledCancelButton
          data-testid="cancel-button"
          onClick={handleCancelClick}
        >
          Reset
        </StyledCancelButton>
      )}
      {rightComponent}
    </StyledBar>
  );
});



ViewBarDetails.displayName = 'ViewBarDetails';
