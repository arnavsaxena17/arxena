import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { OutreachSenderProfileDraftEditor } from '@/outreach-home/components/OutreachSenderProfileDraftEditor';
import { OutreachSetupSectionCard } from '@/outreach-home/components/OutreachSetupSectionCard';
import {
  draftOutreachSenderProfile,
  extractOutreachSenderCollateral,
  fetchOutreachSenderLinkedinProfile,
  fetchOutreachSenderProfilePrompt,
  saveOutreachSenderProfile,
  summarizeOutreachSenderProfile,
  updateOutreachSenderLinkedinUrl,
} from '@/outreach-home/utils/outreach-sender-profile-api';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  margin: 0;
`;

const StyledFieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledBadge = styled.span`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  padding: 2px ${themeCssVariables.spacing[1]};
`;

const StyledHiddenFileInput = styled.input`
  display: none;
`;

const StyledJsonToggle = styled.button`
  align-self: flex-start;
  appearance: none;
  background: none;
  border: none;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
`;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const OutreachSetupSenderProfileSection = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingSeed, setIsLoadingSeed] = useState(true);
  const [isFetchingLinkedin, setIsFetchingLinkedin] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [senderNotes, setSenderNotes] = useState('');
  const [collateralText, setCollateralText] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinUnipileAccountId, setLinkedinUnipileAccountId] = useState<
    string | null
  >(null);
  const [linkedinProfileText, setLinkedinProfileText] = useState('');
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [draftJson, setDraftJson] = useState('');
  const [isJsonOpen, setIsJsonOpen] = useState(false);

  const persistLinkedinUrl = useDebouncedCallback(async (nextUrl: string) => {
    if (!accessToken) {
      return;
    }

    try {
      await updateOutreachSenderLinkedinUrl({
        accessToken,
        linkedinUrl: nextUrl,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save LinkedIn URL.',
      });
    }
  }, 600);

  useEffect(() => {
    let cancelled = false;

    const loadSeed = async () => {
      if (!accessToken) {
        setIsLoadingSeed(false);
        return;
      }

      try {
        const seed = await fetchOutreachSenderProfilePrompt({ accessToken });
        if (cancelled) {
          return;
        }
        setLinkedinUrl(seed.linkedinUrl);
        setLinkedinUnipileAccountId(seed.linkedinUnipileAccountId);
        setLinkedinProfileText(seed.linkedinProfileText);
        setSavedSummary(
          summarizeOutreachSenderProfile(seed.existingSenderProfile),
        );
        if (seed.existingSenderProfile) {
          setDraftJson(JSON.stringify(seed.existingSenderProfile, null, 2));
        }
      } catch (error) {
        if (!cancelled) {
          enqueueErrorSnackBar({
            message:
              error instanceof Error
                ? error.message
                : 'Failed to load sender profile.',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSeed(false);
        }
      }
    };

    void loadSeed();

    return () => {
      cancelled = true;
    };
  }, [accessToken, enqueueErrorSnackBar]);

  const handleLinkedinUrlChange = (value: string) => {
    setLinkedinUrl(value);
    void persistLinkedinUrl(value);
  };

  const handleFetchLinkedinProfile = async () => {
    if (!isNonEmptyString(linkedinUrl.trim())) {
      enqueueErrorSnackBar({
        message: 'Enter your LinkedIn URL first.',
      });
      return;
    }

    setIsFetchingLinkedin(true);
    try {
      const result = await fetchOutreachSenderLinkedinProfile({
        accessToken,
        linkedinUrl: linkedinUrl.trim(),
      });
      setLinkedinUrl(result.linkedinUrl);
      setLinkedinProfileText(result.linkedinProfileText);
      enqueueSuccessSnackBar({
        message: 'LinkedIn profile fetched and saved to your seat.',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to fetch LinkedIn profile.',
      });
    } finally {
      setIsFetchingLinkedin(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!isNonEmptyString(linkedinProfileText.trim())) {
      enqueueErrorSnackBar({
        message: 'Fetch your LinkedIn profile before generating a draft.',
      });
      return;
    }

    setIsDrafting(true);
    try {
      const result = await draftOutreachSenderProfile({
        accessToken,
        senderNotes,
        collateralText,
        linkedinProfileText,
      });
      setDraftJson(JSON.stringify(result.draft, null, 2));
      setLinkedinProfileText(result.linkedinProfileText);
      setIsJsonOpen(false);
      enqueueSuccessSnackBar({
        message: 'Sender profile draft ready — review before saving.',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to draft sender profile.',
      });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSave = async () => {
    if (!isNonEmptyString(draftJson.trim())) {
      enqueueErrorSnackBar({ message: 'Generate or paste a draft first.' });
      return;
    }

    let senderProfile: Record<string, unknown>;
    try {
      senderProfile = JSON.parse(draftJson) as Record<string, unknown>;
    } catch {
      enqueueErrorSnackBar({ message: 'Draft JSON is invalid.' });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveOutreachSenderProfile({
        accessToken,
        senderProfile,
        senderNotes,
        collateralText,
        linkedinProfileText,
      });
      setSavedSummary(
        summarizeOutreachSenderProfile(saved.outreachSenderProfile),
      );
      setDraftJson(JSON.stringify(saved.outreachSenderProfile, null, 2));
      enqueueSuccessSnackBar({ message: 'Sender profile saved to your seat.' });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save sender profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setIsExtracting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const result = await extractOutreachSenderCollateral({
        accessToken,
        fileName: file.name,
        fileBase64,
      });
      setCollateralText((previous) =>
        isNonEmptyString(previous.trim())
          ? `${previous.trim()}\n\n--- ${file.name} ---\n${result.collateralText}`
          : result.collateralText,
      );
      enqueueSuccessSnackBar({ message: `Extracted text from ${file.name}` });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to extract collateral.',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const hasLinkedinUnipile = isNonEmptyString(linkedinUnipileAccountId);

  return (
    <OutreachSetupSectionCard
      title="Sender profile"
      description="Voice, offer, and ICP for outbound messages on your seat. Fetch your LinkedIn profile, then review the draft before saving."
      headerAdornment={
        <StyledBadge>
          {savedSummary ? `Saved · ${savedSummary}` : 'Not saved yet'}
        </StyledBadge>
      }
    >
      {isLoadingSeed ? (
        <StyledMuted>Loading sender profile…</StyledMuted>
      ) : (
        <>
          <StyledFieldStack>
            <StyledFieldLabel>LinkedIn URL</StyledFieldLabel>
            <TextInput
              value={linkedinUrl}
              onChange={handleLinkedinUrlChange}
              placeholder="https://www.linkedin.com/in/your-profile"
              fullWidth
              disabled={!accessToken}
            />
            <StyledActions>
              <Button
                title={
                  isFetchingLinkedin ? 'Fetching…' : 'Fetch LinkedIn profile'
                }
                variant="secondary"
                size="small"
                onClick={() => {
                  void handleFetchLinkedinProfile();
                }}
                disabled={
                  isFetchingLinkedin ||
                  isDrafting ||
                  isSaving ||
                  !accessToken ||
                  !isNonEmptyString(linkedinUrl.trim())
                }
              />
            </StyledActions>
            {!hasLinkedinUnipile && (
              <StyledMuted>
                Connect LinkedIn Unipile on this seat (Settings → Accounts) so
                we can fetch the profile.
              </StyledMuted>
            )}
          </StyledFieldStack>

          <StyledFieldStack>
            <StyledFieldLabel>LinkedIn profile</StyledFieldLabel>
            {isNonEmptyString(linkedinProfileText) ? (
              <TextArea
                textAreaId="outreach-setup-sender-linkedin-profile"
                minRows={6}
                maxRows={14}
                value={linkedinProfileText}
                onChange={setLinkedinProfileText}
                placeholder="Formatted LinkedIn profile appears here after fetch."
              />
            ) : (
              <StyledMuted>
                No LinkedIn profile saved yet. Enter your URL and fetch it.
              </StyledMuted>
            )}
          </StyledFieldStack>

          <StyledFieldStack>
            <StyledFieldLabel>Sender notes</StyledFieldLabel>
            <TextArea
              textAreaId="outreach-setup-sender-notes"
              minRows={3}
              maxRows={8}
              value={senderNotes}
              onChange={setSenderNotes}
              placeholder="ICP focus, offer nuances, what to avoid, preferred meeting length…"
            />
          </StyledFieldStack>

          <StyledFieldStack>
            <StyledFieldLabel>
              Collateral (paste or upload PDF / DOCX / TXT)
            </StyledFieldLabel>
            <TextArea
              textAreaId="outreach-setup-sender-collateral"
              minRows={3}
              maxRows={10}
              value={collateralText}
              onChange={setCollateralText}
              placeholder="Paste pitch deck talking points, one-pagers, FAQ…"
            />
            <StyledActions>
              <Button
                title={isExtracting ? 'Extracting…' : 'Upload file'}
                variant="secondary"
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting || !accessToken}
              />
              <StyledHiddenFileInput
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown"
                onChange={(event) => {
                  void handleFileSelected(event);
                }}
              />
            </StyledActions>
          </StyledFieldStack>

          <StyledActions>
            <Button
              title={isDrafting ? 'Generating…' : 'Generate draft'}
              variant="secondary"
              size="small"
              onClick={() => {
                void handleGenerateDraft();
              }}
              disabled={
                isDrafting ||
                isSaving ||
                isFetchingLinkedin ||
                !accessToken ||
                !isNonEmptyString(linkedinProfileText)
              }
            />
            <Button
              title={isSaving ? 'Saving…' : 'Save to my seat'}
              variant="primary"
              size="small"
              onClick={() => {
                void handleSave();
              }}
              disabled={
                isSaving ||
                isDrafting ||
                isFetchingLinkedin ||
                !isNonEmptyString(draftJson)
              }
            />
          </StyledActions>
          {isNonEmptyString(draftJson) && (
            <StyledFieldStack>
              <StyledFieldLabel>Review draft before save</StyledFieldLabel>
              <StyledMuted>
                Edit fields below. Use Edit as JSON only if you need a raw
                override.
              </StyledMuted>
              <OutreachSenderProfileDraftEditor
                draftJson={draftJson}
                onChange={setDraftJson}
                disabled={isSaving || isDrafting}
              />
              <StyledJsonToggle
                type="button"
                onClick={() => setIsJsonOpen((open) => !open)}
              >
                {isJsonOpen ? 'Hide JSON' : 'Edit as JSON'}
              </StyledJsonToggle>
              {isJsonOpen && (
                <TextArea
                  textAreaId="outreach-setup-sender-draft"
                  minRows={10}
                  maxRows={24}
                  value={draftJson}
                  onChange={setDraftJson}
                />
              )}
            </StyledFieldStack>
          )}
        </>
      )}
    </OutreachSetupSectionCard>
  );
};
