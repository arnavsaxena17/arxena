import { getDefaultAdvancedFilterOperand } from '@/object-record/advanced-filter/utils/getDefaultAdvancedFilterOperand';
import { getRecordFilterOperands } from '@/object-record/record-filter/utils/getRecordFilterOperands';
import { ViewFilterOperand } from '@/views/types/ViewFilterOperand';

describe('getDefaultAdvancedFilterOperand', () => {
  it('should default DATE fields to IS_RELATIVE', () => {
    expect(getDefaultAdvancedFilterOperand({ filterType: 'DATE' })).toBe(
      ViewFilterOperand.IsRelative,
    );
  });

  it('should default DATE_TIME fields to IS_RELATIVE', () => {
    expect(getDefaultAdvancedFilterOperand({ filterType: 'DATE_TIME' })).toBe(
      ViewFilterOperand.IsRelative,
    );
  });

  it('should keep the first available operand for non-date fields', () => {
    const filterType = 'TEXT';

    expect(getDefaultAdvancedFilterOperand({ filterType })).toBe(
      getRecordFilterOperands({ filterType })[0],
    );
  });
});
