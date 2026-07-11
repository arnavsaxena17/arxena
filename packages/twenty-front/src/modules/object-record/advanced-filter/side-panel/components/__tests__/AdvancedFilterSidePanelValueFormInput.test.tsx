import { render, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';

import { AdvancedFilterSidePanelValueFormInput } from '@/object-record/advanced-filter/side-panel/components/AdvancedFilterSidePanelValueFormInput';
import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { getAdvancedFilterObjectFilterDropdownComponentInstanceId } from '@/object-record/advanced-filter/utils/getAdvancedFilterObjectFilterDropdownComponentInstanceId';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { RecordFiltersComponentInstanceContext } from '@/object-record/record-filter/states/context/RecordFiltersComponentInstanceContext';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { ViewFilterOperand } from '@/views/types/ViewFilterOperand';
import { FieldMetadataType } from 'twenty-shared/types';
import { getMockObjectMetadataItemOrThrow } from '~/testing/utils/getMockObjectMetadataItemOrThrow';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

jest.mock('@/object-record/record-field/components/FormFieldInput', () => ({
  FormFieldInput: () => null,
}));

jest.mock(
  '@/object-record/record-field/form-types/components/FormSelectFieldInput',
  () => ({
    FormSelectFieldInput: ({
      options,
    }: {
      options: { value: string }[];
    }) => <div data-testid="select-options-count">{options.length}</div>,
  }),
);

jest.mock(
  '@/object-record/record-field/form-types/components/FormMultiSelectFieldInput',
  () => ({
    FormMultiSelectFieldInput: ({
      options,
    }: {
      options: { value: string }[];
    }) => <div data-testid="multiselect-options-count">{options.length}</div>,
  }),
);

const INSTANCE_ID = 'advanced-filter-value-test';
const FILTER_ID = 'relation-select-filter';

const opportunity = getMockObjectMetadataItemOrThrow('opportunity');

const relationField = opportunity.fields.find(
  (field) => field.type === FieldMetadataType.RELATION,
);

const selectField = opportunity.fields.find(
  (field) =>
    field.type === FieldMetadataType.SELECT && (field.options?.length ?? 0) > 0,
);

if (!relationField || !selectField) {
  throw new Error('Missing relation or select field in opportunity mock');
}

const relationToSelectFilter: RecordFilter = {
  id: FILTER_ID,
  fieldMetadataId: relationField.id,
  relationTargetFieldMetadataId: selectField.id,
  type: FieldMetadataType.SELECT,
  operand: ViewFilterOperand.Is,
  value: '',
  displayValue: '',
  label: `${relationField.label} → ${selectField.label}`,
};

const BaseWrapper = getJestMetadataAndApolloMocksWrapper({ apolloMocks: [] });

const Seed = ({ children }: { children: React.ReactNode }) => {
  const setCurrentRecordFilters = useSetRecoilComponentStateV2(
    currentRecordFiltersComponentState,
  );
  const setFieldMetadataItemIdUsedInDropdown = useSetRecoilComponentStateV2(
    fieldMetadataItemIdUsedInDropdownComponentState,
    getAdvancedFilterObjectFilterDropdownComponentInstanceId(FILTER_ID),
  );

  const [isSeeded, setIsSeeded] = useState(false);

  useEffect(() => {
    setCurrentRecordFilters([relationToSelectFilter]);
    setFieldMetadataItemIdUsedInDropdown(relationField.id);
    setIsSeeded(true);
  }, [setCurrentRecordFilters, setFieldMetadataItemIdUsedInDropdown]);

  return isSeeded ? <>{children}</> : null;
};

const Wrapper = () => (
  <BaseWrapper>
    <AdvancedFilterContext.Provider
      value={{ objectMetadataItem: opportunity, isWorkflowFindRecords: false }}
    >
      <RecordFiltersComponentInstanceContext.Provider
        value={{ instanceId: INSTANCE_ID }}
      >
        <ObjectFilterDropdownComponentInstanceContext.Provider
          value={{
            instanceId:
              getAdvancedFilterObjectFilterDropdownComponentInstanceId(
                FILTER_ID,
              ),
          }}
        >
          <Seed>
            <AdvancedFilterSidePanelValueFormInput recordFilterId={FILTER_ID} />
          </Seed>
        </ObjectFilterDropdownComponentInstanceContext.Provider>
      </RecordFiltersComponentInstanceContext.Provider>
    </AdvancedFilterContext.Provider>
  </BaseWrapper>
);

describe('AdvancedFilterSidePanelValueFormInput', () => {
  it('resolves select options from the relation target field for a relation-traversal filter', async () => {
    const { getByTestId } = render(<Wrapper />);

    await waitFor(() => {
      expect(getByTestId('select-options-count').textContent).toBe(
        String(selectField.options?.length),
      );
    });
  });
});
