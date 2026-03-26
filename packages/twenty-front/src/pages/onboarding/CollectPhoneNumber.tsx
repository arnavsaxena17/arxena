import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { H2Title, LightButton, MainButton } from 'twenty-ui';
import { isValidPhoneNumber } from 'libphonenumber-js';

import { SubTitle } from '@/auth/components/SubTitle';
import { Title } from '@/auth/components/Title';
import { useAuth } from '@/auth/hooks/useAuth';
import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersStates';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { useCountries } from '@/ui/input/components/internal/hooks/useCountries';
import { Trans, useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared';
import { OnboardingStatus } from '~/generated/graphql';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';

// ─── Styled components ───────────────────────────────────────────────────────

const StyledContentContainer = styled.div`
  width: 100%;
`;

const StyledSectionContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
`;

const StyledButtonContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(8)};
  width: 200px;
`;

const StyledSkipContainer = styled.div`
  margin-top: ${({ theme }) => theme.spacing(3)};
  display: flex;
  justify-content: center;
`;

/** Wrapper that establishes the relative context for the dropdown */
const StyledPhoneRow = styled.div`
  display: flex;
  position: relative;
`;

const StyledPhoneInputContainer = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: flex;
  height: 32px;
  width: 100%;

  &:focus-within {
    border-color: ${({ theme }) => theme.color.blue};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.color.blue}20;
  }
`;

/** The flag + calling-code trigger button */
const StyledPickerButton = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-right: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm} 0 0
    ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  height: 100%;
  outline: none;
  padding: 0 ${({ theme }) => theme.spacing(2)};
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledFlagWrapper = styled.span`
  align-items: center;
  display: flex;

  svg {
    border-radius: 2px;
    display: block;
    height: 12px;
    width: 16px;
  }
`;

const StyledCallingCode = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledChevron = styled.span`
  color: ${({ theme }) => theme.font.color.light};
  font-size: 9px;
  line-height: 1;
`;

/** Absolutely-positioned dropdown — rendered inside the modal DOM, no portal */
const StyledDropdown = styled.div`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  left: 0;
  max-height: 240px;
  overflow-y: auto;
  position: absolute;
  top: calc(100% + 4px);
  width: 240px;
  z-index: 1000;
`;

const StyledSearchInput = styled.input`
  background: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  outline: none;
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
  }
`;

const StyledOption = styled.button<{ isSelected: boolean }>`
  align-items: center;
  background: ${({ isSelected, theme }) =>
    isSelected ? theme.background.transparent.light : 'transparent'};
  border: none;
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(1.5)} ${theme.spacing(2)}`};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.lighter};
  }
`;

const StyledPhoneNumberInput = styled.input`
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.font.color.primary};
  flex: 1;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  height: 100%;
  outline: none;
  padding: 0 ${({ theme }) => theme.spacing(2)};

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
  }
`;

const StyledErrorMessage = styled.div`
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.xs};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

// ─── Component ───────────────────────────────────────────────────────────────

const signupUserOnArxena = async (userData: {
  fullName: string;
  email: string;
  phone: string;
  token: string;
  password: string;
  origin: string;
  visitorFp: string;
  currentWorkspaceMemberId: string;
  twentyId: string;
  currentWorkspaceId: string;
}) => {
  try {
    let arxenaSiteBaseUrl = '';
    if (process.env.NODE_ENV === 'development') {
      arxenaSiteBaseUrl =
        process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'http://localhost:5050';
    } else {
      arxenaSiteBaseUrl =
        process.env.REACT_APP_ARXENA_SITE_BASE_URL || 'https://arxena.com';
    }
    const requestParams = new URLSearchParams({
      full_name: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      token: userData.token,
      password: userData.password,
      origin: userData.origin || '',
      visitor_fp: userData.visitorFp || '',
      currentWorkspaceMemberId: userData.currentWorkspaceMemberId || '',
      twentyId: userData.twentyId || '',
      currentWorkspaceId: userData.currentWorkspaceId || '',
    });
    await fetch(arxenaSiteBaseUrl + '/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: requestParams,
    });
  } catch {
    // Best-effort; continue onboarding on failure
  }
};

export const CollectPhoneNumber = () => {
  const { t } = useLingui();
  const { loadCurrentUser } = useAuth();
  const onboardingStatus = useOnboardingStatus();
  const setNextOnboardingStatus = useSetNextOnboardingStatus();

  const [currentWorkspaceMember, setCurrentWorkspaceMember] = useRecoilState(
    currentWorkspaceMemberState,
  );
  const currentWorkspaceMembers = useRecoilValue(currentWorkspaceMembersState);
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);

  const { updateOneRecord } = useUpdateOneRecord<WorkspaceMember>({
    objectNameSingular: CoreObjectNameSingular.WorkspaceMember,
  });

  const countries = useCountries();
  const [countryCode, setCountryCode] = useState<string>('US');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) {
        setIsPickerOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  const filteredCountries = useMemo(
    () =>
      countries.filter((c) =>
        c.countryName.toLowerCase().includes(search.toLowerCase()),
      ),
    [countries, search],
  );

  const selectedCountry = useMemo(
    () => countries.find((c) => c.countryCode === countryCode),
    [countries, countryCode],
  );

  const getFullPhoneNumber = useCallback(() => {
    const callingCode = selectedCountry ? `+${selectedCountry.callingCode}` : '+1';
    const digits = phoneNumber.replace(/\D/g, '');
    return `${callingCode}${digits}`;
  }, [selectedCountry, phoneNumber]);

  const validate = useCallback(() => {
    if (!phoneNumber.trim()) {
      setError(t`Phone number cannot be empty`);
      return false;
    }
    if (!isValidPhoneNumber(getFullPhoneNumber())) {
      setError(t`Please enter a valid phone number`);
      return false;
    }
    setError('');
    return true;
  }, [phoneNumber, getFullPhoneNumber, t]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      let workspaceMemberId = currentWorkspaceMember?.id;

      if (!workspaceMemberId) {
        const { workspaceMember } = await loadCurrentUser();
        workspaceMemberId =
          workspaceMember?.id ?? currentWorkspaceMembers[0]?.id;
      }

      if (!workspaceMemberId) {
        setNextOnboardingStatus();
        return;
      }

      const fullPhone = getFullPhoneNumber();

      await updateOneRecord({
        idToUpdate: workspaceMemberId,
        updateOneRecordInput: { phoneNumber: fullPhone },
      });

      setCurrentWorkspaceMember((current) => {
        const base =
          current ??
          currentWorkspaceMembers.find((m) => m.id === workspaceMemberId);
        return isDefined(base) ? { ...base, phoneNumber: fullPhone } : current;
      });

      // Arxena signup is deferred to here so it runs once with complete data
      // (name was saved in CreateProfile; phone is now available)
      const memberName = currentWorkspaceMember?.name;
      await signupUserOnArxena({
        fullName:
          memberName?.firstName && memberName?.lastName
            ? `${memberName.firstName} ${memberName.lastName}`
            : currentUser?.email?.toLowerCase().trim() ?? '',
        email: currentUser?.email?.toLowerCase().trim() ?? '',
        phone: fullPhone,
        password: 'password',
        visitorFp: 'some-fingerprint-value',
        token: 'some',
        currentWorkspaceMemberId: workspaceMemberId,
        currentWorkspaceId: currentWorkspace?.id ?? '',
        twentyId: currentUser?.id ?? '',
        origin: currentWorkspace?.subdomain || '',
      });

      setNextOnboardingStatus();
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validate,
    currentWorkspaceMember,
    currentWorkspaceMembers,
    loadCurrentUser,
    getFullPhoneNumber,
    updateOneRecord,
    setCurrentWorkspaceMember,
    setNextOnboardingStatus,
    currentUser,
    currentWorkspace,
  ]);

  const handleSkip = useCallback(async () => {
    const workspaceMemberId =
      currentWorkspaceMember?.id ?? currentWorkspaceMembers[0]?.id;
    const memberName = currentWorkspaceMember?.name;
    await signupUserOnArxena({
      fullName:
        memberName?.firstName && memberName?.lastName
          ? `${memberName.firstName} ${memberName.lastName}`
          : currentUser?.email?.toLowerCase().trim() ?? '',
      email: currentUser?.email?.toLowerCase().trim() ?? '',
      phone: '',
      password: 'password',
      visitorFp: 'some-fingerprint-value',
      token: 'some',
      currentWorkspaceMemberId: workspaceMemberId ?? '',
      currentWorkspaceId: currentWorkspace?.id ?? '',
      twentyId: currentUser?.id ?? '',
      origin: currentWorkspace?.subdomain || '',
    });
    setNextOnboardingStatus();
  }, [
    currentWorkspaceMember,
    currentWorkspaceMembers,
    currentUser,
    currentWorkspace,
    setNextOnboardingStatus,
  ]);

  if (onboardingStatus !== OnboardingStatus.COLLECT_PHONE_NUMBER) {
    return null;
  }

  const placeholderCallingCode = selectedCountry
    ? `+${selectedCountry.callingCode}`
    : '+1';

  return (
    <>
      <Title noMarginTop>
        <Trans>Add your phone number</Trans>
      </Title>
      <SubTitle>
        <Trans>Used to contact you and verify your account.</Trans>
      </SubTitle>
      <StyledContentContainer>
        <StyledSectionContainer>
          <H2Title
            title={t`Phone Number`}
            description={t`Your phone number with country code`}
          />
          {/* position:relative here so the dropdown is scoped inside the modal */}
          <StyledPhoneRow ref={pickerRef}>
            <StyledPhoneInputContainer>
              {/* Country picker trigger */}
              <StyledPickerButton
                type="button"
                onClick={() => setIsPickerOpen((open) => !open)}
                aria-label={t`Select country code`}
              >
                <StyledFlagWrapper>
                  {selectedCountry && <selectedCountry.Flag />}
                </StyledFlagWrapper>
                <StyledCallingCode>+{selectedCountry?.callingCode ?? '1'}</StyledCallingCode>
                <StyledChevron>▾</StyledChevron>
              </StyledPickerButton>

              {/* Phone number digits input */}
              <StyledPhoneNumberInput
                type="tel"
                placeholder={`${placeholderCallingCode} 555 000 0000`}
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
              />
            </StyledPhoneInputContainer>

            {/* Inline dropdown — no FloatingPortal, stays inside modal DOM */}
            {isPickerOpen && (
              <StyledDropdown>
                <StyledSearchInput
                  placeholder={t`Search country...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                {filteredCountries.map((country) => (
                  <StyledOption
                    key={country.countryCode}
                    type="button"
                    isSelected={country.countryCode === countryCode}
                    onClick={() => {
                      setCountryCode(country.countryCode);
                      setIsPickerOpen(false);
                      setSearch('');
                    }}
                  >
                    <StyledFlagWrapper>
                      <country.Flag />
                    </StyledFlagWrapper>
                    {country.countryName} (+{country.callingCode})
                  </StyledOption>
                ))}
              </StyledDropdown>
            )}
          </StyledPhoneRow>

          {error && <StyledErrorMessage>{error}</StyledErrorMessage>}
        </StyledSectionContainer>
      </StyledContentContainer>

      <StyledButtonContainer>
        <MainButton
          title={t`Continue`}
          onClick={handleSave}
          disabled={isSubmitting}
          fullWidth
        />
        <StyledSkipContainer>
          <LightButton title={t`Skip`} onClick={handleSkip} />
        </StyledSkipContainer>
      </StyledButtonContainer>
    </>
  );
};
