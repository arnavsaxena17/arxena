import { styled } from '@linaria/react';
import { type ReactNode, useMemo } from 'react';
import { Avatar } from 'twenty-ui/data-display';
import { Checkbox, CheckboxVariant } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// Phone layout for the outreach tables: one card per record so name,
// role, company and status are all visible without horizontal scrolling.

export type OutreachRecordCard = {
  title: string;
  avatarType: 'rounded' | 'squared';
  avatarUrl?: string | null;
  status?: ReactNode;
  subtitle?: string;
  footer?: ReactNode;
};

const StyledList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

const StyledCard = styled.div<{ isHighlighted: boolean }>`
  background: ${({ isHighlighted }) =>
    isHighlighted
      ? themeCssVariables.accent.quaternary
      : themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};

  &:active {
    background: ${themeCssVariables.background.secondary};
  }
`;

// 44px tap target around the checkbox
const StyledCheckboxTarget = styled.div`
  align-items: flex-start;
  display: flex;
  justify-content: center;
  margin: -${themeCssVariables.spacing[3]}
    0 -${themeCssVariables.spacing[3]} -${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[3]} 0 0 ${themeCssVariables.spacing[4]};
  width: 28px;
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledTopRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-weight: ${themeCssVariables.font.weight.medium};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStatus = styled.div`
  flex-shrink: 0;
`;

const StyledSubtitle = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledFooter = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

type OutreachRecordCardListProps<TRow> = {
  rows: TRow[];
  getRowId: (row: TRow) => string;
  getCard: (row: TRow) => OutreachRecordCard;
  selectedRowIds: string[];
  activeRowId?: string | null;
  onSelectedRowIdsChange: (rowIds: string[]) => void;
  onRowClick?: (row: TRow) => void;
};

export const OutreachRecordCardList = <TRow,>({
  rows,
  getRowId,
  getCard,
  selectedRowIds,
  activeRowId,
  onSelectedRowIdsChange,
  onRowClick,
}: OutreachRecordCardListProps<TRow>) => {
  const selectedRowIdSet = useMemo(
    () => new Set(selectedRowIds),
    [selectedRowIds],
  );

  const handleToggleRow = (rowId: string) => {
    onSelectedRowIdsChange(
      selectedRowIdSet.has(rowId)
        ? selectedRowIds.filter((selectedRowId) => selectedRowId !== rowId)
        : [...selectedRowIds, rowId],
    );
  };

  return (
    <StyledList>
      {rows.map((row) => {
        const rowId = getRowId(row);
        const isSelected = selectedRowIdSet.has(rowId);
        const card = getCard(row);

        return (
          <StyledCard
            key={rowId}
            isHighlighted={isSelected || rowId === activeRowId}
            onClick={() => onRowClick?.(row)}
          >
            <StyledCheckboxTarget
              onClick={(event) => {
                event.stopPropagation();
                handleToggleRow(rowId);
              }}
            >
              <Checkbox
                checked={isSelected}
                variant={CheckboxVariant.Secondary}
                aria-label={`Select ${card.title}`}
              />
            </StyledCheckboxTarget>
            <Avatar
              avatarUrl={card.avatarUrl}
              placeholder={card.title}
              placeholderColorSeed={card.title}
              type={card.avatarType}
              size="lg"
            />
            <StyledBody>
              <StyledTopRow>
                <StyledTitle>{card.title || 'Untitled'}</StyledTitle>
                {card.status !== undefined && (
                  <StyledStatus>{card.status}</StyledStatus>
                )}
              </StyledTopRow>
              {card.subtitle !== undefined && card.subtitle.length > 0 && (
                <StyledSubtitle title={card.subtitle}>
                  {card.subtitle}
                </StyledSubtitle>
              )}
              {card.footer !== undefined && (
                <StyledFooter>{card.footer}</StyledFooter>
              )}
            </StyledBody>
          </StyledCard>
        );
      })}
    </StyledList>
  );
};
