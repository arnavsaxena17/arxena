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

const StyledTextarea = styled.textarea`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  max-height: 160px;
  min-height: ${themeCssVariables.spacing[5]};
  min-width: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  resize: vertical;

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

export type OrgChartBusinessDivisionQueryProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
};

export const OrgChartBusinessDivisionQuery = ({
  value,
  onChange,
  onSubmit,
  isSubmitting,
}: OrgChartBusinessDivisionQueryProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isSubmitting && value.trim()) {
        onSubmit();
      }
    }
  };

  // const adjustHeight = (el: HTMLTextAreaElement | null) => {
  //   if (!el) return;
  //   el.style.height = 'auto';
  //   const next = Math.min(el.scrollHeight, 160);
  //   el.style.height = `${Math.max(next, 36)}px`;
  // };

  return (
    <StyledWrap>
      <StyledLabel>Business division</StyledLabel>
      <StyledRow>
        <StyledTextarea
          placeholder="e.g. Textile division.."
          value={value}
          rows={1}
          aria-label="Business division description"
          // onInput={(event) => {
          //   // adjustHeight(event.currentTarget);
          // }}
          onChange={(event) => {
            onChange(event.target.value);
            // adjustHeight(event.target);
          }}
          onKeyDown={handleKeyDown}
        />
        <StyledSubmit
          type="button"
          disabled={isSubmitting || !value.trim()}
          onClick={() => {
            if (value.trim()) onSubmit();
          }}
        >
          Create Map
        </StyledSubmit>
      </StyledRow>
    </StyledWrap>
  );
};
