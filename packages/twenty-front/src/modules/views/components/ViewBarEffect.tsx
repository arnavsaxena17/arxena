import { useEffect, useState } from 'react';
import { isUndefined } from '@sniptt/guards';
import { useRecoilValue } from 'recoil';

import { useViewStates } from '@/views/hooks/internal/useViewStates';
import { useGetCurrentView } from '@/views/hooks/useGetCurrentView';
import { View } from '@/views/types/View';
import { isDeeplyEqual } from '~/utils/isDeeplyEqual';

type ViewBarEffectProps = {
  viewBarId: string;
};

export const ViewBarEffect = ({ viewBarId }: ViewBarEffectProps) => {
  const { currentViewWithCombinedFiltersAndSorts } = useGetCurrentView(viewBarId);


  
  const {
    onCurrentViewChangeState,
    availableFilterDefinitionsState,
    isPersistingViewFieldsState,
  } = useViewStates(viewBarId);

  const [currentViewSnapshot, setCurrentViewSnapshot] = useState<
    View | undefined
  >(undefined);

  const onCurrentViewChange = useRecoilValue(onCurrentViewChangeState);
  const availableFilterDefinitions = useRecoilValue(
    availableFilterDefinitionsState,
  );
  const isPersistingViewFields = useRecoilValue(isPersistingViewFieldsState);


  console.log('ViewBarEffect render:', {
    viewBarId,
    currentViewWithCombinedFiltersAndSorts,
    currentViewSnapshot,
    onCurrentViewChange,
    availableFilterDefinitions,
    isPersistingViewFields
  });

  useEffect(() => {

    console.log('Effect triggered with:', {
      currentView: currentViewWithCombinedFiltersAndSorts,
      snapshot: currentViewSnapshot,
      isPersisting: isPersistingViewFields
    });

    
    try {

      if (isPersistingViewFields) {
        return;
      }
  
      // Skip if no change handler
      if (!onCurrentViewChange) {
        return;
      }
  
      if (!currentViewWithCombinedFiltersAndSorts || !currentViewSnapshot) {
        if (currentViewWithCombinedFiltersAndSorts !== currentViewSnapshot) {
          setCurrentViewSnapshot(currentViewWithCombinedFiltersAndSorts);
          onCurrentViewChange(currentViewWithCombinedFiltersAndSorts);
        }
        return;
      }
    
      // Early return if required values are missing
      if (!onCurrentViewChange || !viewBarId) {
        return;
      }

      // Handle case where views are equal
      if (currentViewWithCombinedFiltersAndSorts === currentViewSnapshot) {
        return;
      }

      // Handle case where either value is undefined
      if (!currentViewWithCombinedFiltersAndSorts || !currentViewSnapshot) {
        if (currentViewWithCombinedFiltersAndSorts !== currentViewSnapshot) {
          setCurrentViewSnapshot(currentViewWithCombinedFiltersAndSorts);
          onCurrentViewChange(currentViewWithCombinedFiltersAndSorts);
        }
        return;
      }

      

      // Only do deep comparison if both objects exist
      const hasViewChanged = !isDeeplyEqual(
        currentViewWithCombinedFiltersAndSorts,
        currentViewSnapshot
      );

      if (hasViewChanged && !isPersistingViewFields) {
        setCurrentViewSnapshot(currentViewWithCombinedFiltersAndSorts);
        onCurrentViewChange(currentViewWithCombinedFiltersAndSorts);
      }
    } catch (error) {
      console.error('Error in ViewBarEffect:', {
        error,
        currentView: currentViewWithCombinedFiltersAndSorts,
        snapshot: currentViewSnapshot,
        viewBarId
      });
    }
  }, [
    viewBarId,
    currentViewWithCombinedFiltersAndSorts,
    currentViewSnapshot,
    onCurrentViewChange,
    isPersistingViewFields,
    availableFilterDefinitions
  ]);

  return null;
};
