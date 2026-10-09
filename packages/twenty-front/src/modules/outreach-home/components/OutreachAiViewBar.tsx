import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachTableView } from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { describeOutreachTableFilter } from '@/outreach-home/utils/outreach-table-view';

const StyledBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  white-space: nowrap;
`;

const StyledChip = styled.span`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  padding: 2px ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

const StyledClear = styled.button`
  background: none;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  margin-left: auto;
  text-decoration: underline;
`;

type OutreachAiViewBarProps = {
  view: OutreachTableView | null | undefined;
  getColumnLabel: (columnId: string) => string;
  onClear: () => void;
};

export const OutreachAiViewBar = ({
  view,
  getColumnLabel,
  onClear,
}: OutreachAiViewBarProps) => {
  if (!view || (view.filters.length === 0 && view.sort === null)) {
    return null;
  }

  return (
    <StyledBar role="status" aria-label="AI view">
      <StyledLabel>AI view</StyledLabel>
      {view.filters.map((filter) => (
        <StyledChip key={`${filter.columnId}:${filter.kind}`}>
          {describeOutreachTableFilter(filter, getColumnLabel(filter.columnId))}
        </StyledChip>
      ))}
      {view.sort !== null && (
        <StyledChip>
          Sorted by {getColumnLabel(view.sort.columnId)}{' '}
          {view.sort.direction === 'asc' ? '↑' : '↓'}
        </StyledChip>
      )}
      <StyledClear type="button" onClick={onClear}>
        Clear
      </StyledClear>
    </StyledBar>
  );
};
