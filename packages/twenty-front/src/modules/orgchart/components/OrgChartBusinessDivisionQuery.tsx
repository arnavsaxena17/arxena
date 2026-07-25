import type { KeyboardEvent } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  flex: 1 1 220px;
  min-width: 0;
  max-width: 400px;
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

const StyledTextarea = styled.textarea`
  flex: 1;
  min-width: 0;
  min-height: ${themeCssVariables.spacing[5]};
  max-height: 160px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  line-height: 1.4;
  resize: vertical;
  overflow-y: auto;

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
