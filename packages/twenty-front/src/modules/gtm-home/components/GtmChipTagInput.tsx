import { styled } from '@linaria/react';
import { type KeyboardEvent, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { BaseChip } from '@/object-record/record-field/ui/form-types/components/BaseChip';

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  min-height: 28px;
`;

const StyledAddInput = styled.input`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 120px;
  outline: none;
  padding: ${themeCssVariables.spacing[1]} 0;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

type GtmChipTagInputProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export const GtmChipTagInput = ({
  values,
  onChange,
  placeholder = 'Add and press Enter',
  disabled = false,
}: GtmChipTagInputProps) => {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const next = draft.trim();

    if (next.length === 0 || values.includes(next)) {
      setDraft('');

      return;
    }

    onChange([...values, next]);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    }

    if (event.key === 'Backspace' && draft.length === 0 && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <StyledRow>
      {values.map((value) => (
        <BaseChip
          key={value}
          label={value}
          onRemove={
            disabled
              ? undefined
              : (event) => {
                  event.stopPropagation();
                  onChange(values.filter((item) => item !== value));
                }
          }
        />
      ))}
      <StyledAddInput
        value={draft}
        disabled={disabled}
        placeholder={values.length === 0 ? placeholder : 'Add'}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={handleKeyDown}
      />
    </StyledRow>
  );
};
