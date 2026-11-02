import { InputErrorHelper } from '@/ui/input/components/InputErrorHelper';
import { InputLabel } from '@/ui/input/components/InputLabel';
import { styled } from '@linaria/react';
import { type E164Number } from 'libphonenumber-js';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 100%;
  width: 100%;
`;

const StyledInputWrapper = styled.div`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  height: ${themeCssVariables.spacing[8]};
  width: 100%;

  &:focus-within {
    border-color: ${themeCssVariables.border.color.strong};
  }

  .PhoneInputCountry {
    align-items: center;
    border-right: 1px solid ${themeCssVariables.border.color.light};
    display: flex;
    margin-right: 0;
    padding: 0 ${themeCssVariables.spacing[2]};
  }

  .PhoneInputCountryIcon {
    height: 14px;
    width: 20px;
  }

  .PhoneInputCountrySelectArrow {
    color: ${themeCssVariables.font.color.light};
    margin-left: ${themeCssVariables.spacing[1]};
  }

  .PhoneInputInput {
    background: transparent;
    border: none;
    color: ${themeCssVariables.font.color.primary};
    flex: 1;
    font-family: ${themeCssVariables.font.family};
    font-size: ${themeCssVariables.font.size.md};
    height: 100%;
    min-width: 0;
    outline: none;
    padding: 0 ${themeCssVariables.spacing[2]};

    &::placeholder {
      color: ${themeCssVariables.font.color.light};
    }
  }
`;

type OnboardingPhoneNumberInputProps = {
  value?: string;
  onChange: (value?: string) => void;
  label: string;
  placeholder?: string;
  error?: string;
};

export const OnboardingPhoneNumberInput = ({
  value,
  onChange,
  label,
  placeholder,
  error,
}: OnboardingPhoneNumberInputProps) => (
  <StyledContainer>
    <InputLabel>{label}</InputLabel>
    <StyledInputWrapper>
      <PhoneInput
        value={(value ?? undefined) as E164Number | undefined}
        onChange={(nextValue) => onChange(nextValue ?? undefined)}
        placeholder={placeholder}
        international
        withCountryCallingCode
        defaultCountry="US"
      />
    </StyledInputWrapper>
    <InputErrorHelper>{error}</InputErrorHelper>
  </StyledContainer>
);
