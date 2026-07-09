import { objectFilterDropdownSearchInputComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSearchInputComponentState';
import { useRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentStateV2';
import styled from '@emotion/styled';
import { t } from '@lingui/core/macro';

export const StyledInput = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: 0;
  border-top: none;
  border-top-left-radius: ${({ theme }) => theme.border.radius.md};
  border-top-right-radius: ${({ theme }) => theme.border.radius.md};
  color: ${({ theme }) => theme.font.color.primary};
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: inherit;
  margin: 0;
  max-width: 100%;
  min-height: 19px;

  outline: none;
  overflow: hidden;
  padding: ${({ theme }) => theme.spacing(2)};
  text-decoration: none;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
  }
`;

export const AdvancedFilterFieldSelectSearchInput = () => {
  const [objectFilterDropdownSearchInput, setObjectFilterDropdownSearchInput] =
    useRecoilComponentStateV2(objectFilterDropdownSearchInputComponentState);

  return (
    <StyledInput
      value={objectFilterDropdownSearchInput}
      autoFocus
      placeholder={t`Search fields`}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
        setObjectFilterDropdownSearchInput(event.target.value)
      }
    />
  );
};
