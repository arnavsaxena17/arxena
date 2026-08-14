import type { KeyboardEvent } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  display: flex;
  flex: 1 1 140px;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  max-width: 260px;
  min-width: 0;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
`;

const StyledRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: ${themeCssVariables.spacing[5]};
  min-width: 0;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

const StyledSubmit = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1.5]};
  white-space: nowrap;

  &:hover:enabled {
    background: ${themeCssVariables.background.transparent.light};
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }
`;

const StyledChips = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[0.5]};
  min-height: ${themeCssVariables.spacing[3]};
`;

const StyledChip = styled.span`
  align-items: center;
  background: ${themeCssVariables.background.transparent.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1.2;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};
`;

const StyledChipDismiss = styled.button`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

export type OrgChartTitleQueryResolved = {
  jobTitle: string;
  normalizedTitle?: string;
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
  confidence?: number;
};

export type OrgChartTitleQueryBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClearResolved: () => void;
  isSubmitting?: boolean;
  resolved?: OrgChartTitleQueryResolved | null;
};

const formatConfidenceLabel = (confidence: number): string => {
  const ratio = confidence > 1 ? confidence / 100 : confidence;

  return `confidence: ${Math.round(ratio * 100)}%`;
};

export const OrgChartTitleQueryBar = ({
  value,
  onChange,
  onSubmit,
  onClearResolved,
  isSubmitting,
  resolved,
}: OrgChartTitleQueryBarProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!isSubmitting && value.trim()) {
        onSubmit();
      }
    }
  };

  const chips: Array<{ key: string; label: string }> = [];

  if (resolved?.stdFunctionRoot) {
    chips.push({
      key: 'root',
      label: `root: ${resolved.stdFunctionRoot}`,
    });
  }
  if (resolved?.stdFunction) {
    chips.push({
      key: 'function',
      label: `function: ${resolved.stdFunction}`,
    });
  }
  if (resolved?.stdGrade) {
    chips.push({
      key: 'grade',
      label: `grade: ${resolved.stdGrade}`,
    });
  }
  if (
    typeof resolved?.confidence === 'number' &&
    Number.isFinite(resolved.confidence)
  ) {
    chips.push({
      key: 'confidence',
      label: formatConfidenceLabel(resolved.confidence),
    });
  }

  return (
    <StyledWrap>
      <StyledLabel>Title query</StyledLabel>
      <StyledRow>
        <StyledInput
          placeholder="e.g. CHRO / Head of HR"
          value={value}
          aria-label="Resolve job title on org chart"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <StyledSubmit
          type="button"
          disabled={isSubmitting || !value.trim()}
          onClick={() => {
            if (value.trim()) onSubmit();
          }}
        >
          {isSubmitting ? 'Resolving…' : 'Resolve'}
        </StyledSubmit>
      </StyledRow>
      {chips.length > 0 && (
        <StyledChips>
          {chips.map((chip) => (
            <StyledChip key={chip.key}>{chip.label}</StyledChip>
          ))}
          <StyledChipDismiss
            type="button"
            aria-label="Clear title resolution"
            onClick={onClearResolved}
          >
            Clear
          </StyledChipDismiss>
        </StyledChips>
      )}
    </StyledWrap>
  );
};
