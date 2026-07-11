import { type ObjectMetadataItem } from '@/object-metadata/types/ObjectMetadataItem';
import { type VariablePickerComponent } from '@/object-record/record-field/form-types/types/VariablePickerComponent';
import { createContext } from 'react';

type AdvancedFilterContextType = {
  onUpdate?: () => void;
  isWorkflowFindRecords?: boolean;
  recordIndexId?: string;
  readonly?: boolean;
  VariablePicker?: VariablePickerComponent;
  objectMetadataItem: ObjectMetadataItem;
};

export const AdvancedFilterContext = createContext<AdvancedFilterContextType>(
  {} as AdvancedFilterContextType,
);
