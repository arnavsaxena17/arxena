import styled from '@emotion/styled';
import type { KeyboardEvent } from 'react';

const StyledWrap = styled.div`
  flex: 1 1 220px;
  min-width: 0;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 0;
`;

const StyledTextarea = styled.textarea`
  flex: 1;
  min-width: 0;
  min-height: ${({ theme }) => theme.spacing(4.5)};
  max-height: 160px;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  line-height: 1.4;
  resize: vertical;
  overflow-y: auto;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledSubmit = styled.button`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  cursor: pointer;
  white-space: nowrap;

  &:hover:enabled {
    background: ${({ theme }) => theme.background.transparent.light};
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
