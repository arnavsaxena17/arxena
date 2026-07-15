'use client';

import styled from '@emotion/styled';
import PhoneInput, { type Country } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';

import 'react-phone-number-input/style.css';

type FreeTrialPhoneInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: Country;
};

const StyledPhoneInputShell = styled.div`
  width: 100%;

  .PhoneInput {
    display: flex;
    align-items: stretch;
    width: 100%;
    height: 48px;
    border: 1px solid rgba(20, 20, 20, 0.14);
    border-radius: 8px;
    box-sizing: border-box;
    background: #fff;
    overflow: hidden;

    &:focus-within {
      outline: 2px solid rgba(37, 99, 235, 0.35);
      border-color: rgba(37, 99, 235, 0.55);
    }
  }

  .PhoneInputCountry {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 0 10px;
    border-right: 1px solid rgba(20, 20, 20, 0.14);
    background: #fafafa;
  }

  .PhoneInputCountryIcon {
    width: 20px;
    height: 15px;
    border-radius: 2px;
    overflow: hidden;
    box-shadow: none;
  }

  .PhoneInputCountryIcon--border {
    background-color: transparent;
    box-shadow: none;
  }

  .PhoneInputCountrySelectArrow {
    width: 6px;
    height: 6px;
    margin-left: 2px;
    border-color: #818181;
    opacity: 1;
  }

  .PhoneInputInput {
    flex: 1;
    width: 100%;
    height: 100%;
    padding: 0 14px;
    border: none;
    border-radius: 0;
    font-size: 15px;
    color: #141414;
    background: transparent;
    box-sizing: border-box;

    &:focus {
      outline: none;
    }

    &::placeholder {
      color: #a3a3a3;
    }
  }
`;

export const FreeTrialPhoneInput = ({
  id,
  value,
  onChange,
  defaultCountry = 'US',
}: FreeTrialPhoneInputProps) => {
  return (
    <StyledPhoneInputShell>
      <PhoneInput
        id={id}
        international
        withCountryCallingCode
        defaultCountry={defaultCountry}
        flags={flags}
        placeholder="Phone number"
        value={value || undefined}
        onChange={(nextValue) => {
          onChange(nextValue ?? '');
        }}
      />
    </StyledPhoneInputShell>
  );
};
