import type { KeyboardEvent } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  flex: 1 1 240px;
  min-width: 0;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledLabel = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledInput = styled.input`
  flex: 1;
  min-width: 0;
  height: ${themeCssVariables.spacing[5]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledSubmit = styled.button`
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1.5]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  cursor: pointer;
  white-space: nowrap;

  &:hover:enabled {
    background: ${themeCssVariables.background.transparent.light};
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

const StyledChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${themeCssVariables.spacing[0.5]};
  min-height: ${themeCssVariables.spacing[3]};
`;

const StyledChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.transparent.medium};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1.2;
`;

const StyledChipDismiss = styled.button`
  padding: ${themeCssVariables.spacing[0.5]} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1;

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
