import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachColumnFilter } from '@/outreach-home/utils/outreach-table-layout.util';

const StyledMenu = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  max-height: 280px;
  min-width: 220px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};
  position: fixed;
  z-index: 20;
`;

const StyledMenuButton = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[1]};
  text-align: left;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledLabel = styled.label`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledConditionRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledInput = styled.input`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
  padding: ${themeCssVariables.spacing[1]};
`;

const StyledSelect = styled.select`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
`;

type OutreachRecordTableColumnMenuProps<TRow> = {
  columnId: string;
  rows: TRow[];
  getCellText: (row: TRow) => string;
  filter: OutreachColumnFilter | undefined;
  canHide: boolean;
  valueType?: 'text' | 'number';
  top: number;
  left: number;
  onHide: () => void;
  onFilterChange: (filter: OutreachColumnFilter | null) => void;
};

export const OutreachRecordTableColumnMenu = <TRow,>({
  columnId,
  rows,
  getCellText,
  filter,
  canHide,
  valueType = 'text',
  top,
  left,
  onHide,
  onFilterChange,
}: OutreachRecordTableColumnMenuProps<TRow>) => {
  const distinctValues = useMemo(() => {
    const values = new Set(rows.map((row) => getCellText(row)));

    return [...values].sort((left, right) => left.localeCompare(right));
  }, [getCellText, rows]);
  const selectedValues =
    filter?.kind === 'values' ? filter.values : distinctValues;
  const [operator, setOperator] = useState<
    Extract<OutreachColumnFilter, { kind: 'condition' }>['operator']
  >(
    filter?.kind === 'condition'
      ? filter.operator
      : valueType === 'number'
        ? 'greaterThan'
        : 'contains',
  );
  const [conditionValue, setConditionValue] = useState(
    filter?.kind === 'condition' ? filter.value : '',
  );

  return (
    <StyledMenu
      style={{ top, left }}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {canHide && (
        <StyledMenuButton type="button" onClick={onHide}>
          Hide column
        </StyledMenuButton>
      )}
      {valueType !== 'number' &&
        distinctValues.map((value) => {
        const checked = selectedValues.includes(value);

        return (
          <StyledLabel key={value || '(empty)'}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                const nextValues = checked
                  ? selectedValues.filter((selected) => selected !== value)
                  : [...selectedValues, value];

                onFilterChange({
                  columnId,
                  kind: 'values',
                  values: nextValues,
                });
              }}
            />
            {value === '' ? '(empty)' : value}
          </StyledLabel>
        );
        })}
      <StyledConditionRow>
        <StyledSelect
          aria-label="Filter condition"
          value={operator}
          onChange={(event) =>
            setOperator(
              event.target.value as Extract<
                OutreachColumnFilter,
                { kind: 'condition' }
              >['operator'],
            )
          }
        >
          <option value="contains">Contains</option>
          <option value="notContains">Does not contain</option>
          <option value="equals">Equals</option>
          {valueType === 'number' && (
            <>
              <option value="greaterThan">Greater than</option>
              <option value="greaterThanOrEqual">Greater than or equal</option>
              <option value="lessThan">Less than</option>
              <option value="lessThanOrEqual">Less than or equal</option>
            </>
          )}
          <option value="empty">Is empty</option>
          <option value="notEmpty">Is not empty</option>
        </StyledSelect>
        {operator !== 'empty' && operator !== 'notEmpty' && (
          <StyledInput
            aria-label="Filter value"
            value={conditionValue}
            onChange={(event) => setConditionValue(event.target.value)}
          />
        )}
        <StyledMenuButton
          type="button"
          onClick={() =>
            onFilterChange({
              columnId,
              kind: 'condition',
              operator,
              value: conditionValue,
            })
          }
        >
          Apply
        </StyledMenuButton>
      </StyledConditionRow>
      {filter && (
        <StyledMenuButton type="button" onClick={() => onFilterChange(null)}>
          Clear filter
        </StyledMenuButton>
      )}
    </StyledMenu>
  );
};
