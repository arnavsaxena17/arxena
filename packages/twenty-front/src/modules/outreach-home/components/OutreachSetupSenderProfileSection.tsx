import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useState } from 'react';
import { type WorkflowEmailFiles } from 'twenty-shared/workflow';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';

import { WorkflowSendEmailAttachments } from '@/advanced-text-editor/components/WorkflowSendEmailAttachments';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { OutreachSenderProfileDraftEditor } from '@/outreach-home/components/OutreachSenderProfileDraftEditor';
import { OutreachSetupSectionCard } from '@/outreach-home/components/OutreachSetupSectionCard';
import {
  appendOutreachSenderCollateralFile,
  fetchOutreachSenderLinkedinProfile,
  fetchOutreachSenderProfilePrompt,
  generateOutreachSenderProfile,
  removeOutreachSenderCollateralFile,
  saveOutreachSenderProfile,
  summarizeOutreachSenderProfile,
  updateOutreachSenderLinkedinUrl,
} from '@/outreach-home/utils/outreach-sender-profile-api';
import {
  normalizeSenderProfileDraft,
  stringifySenderProfileDraft,
} from '@/outreach-home/utils/outreach-sender-profile-draft.util';
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

const readCollateralFilesFromProfile = (
  profile: Record<string, unknown> | null,
): WorkflowEmailFiles => {
  const raw = profile?.collateralFiles;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const file = item as Record<string, unknown>;
      const id = typeof file.fileId === 'string' ? file.fileId : '';
      const name = typeof file.fileName === 'string' ? file.fileName : '';

      if (!isNonEmptyString(id) || !isNonEmptyString(name)) {
        return null;
      }

      return {
        id,
        name,
        size: 0,
        type: typeof file.mimeType === 'string' ? file.mimeType : '',
        createdAt: new Date().toISOString(),
      };
    })
    .filter((file): file is NonNullable<typeof file> => file !== null);
};

export const OutreachSetupSenderProfileSection = () => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const [isLoadingSeed, setIsLoadingSeed] = useState(true);
  const [isFetchingLinkedin, setIsFetchingLinkedin] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [senderNotes, setSenderNotes] = useState('');
  const [collateralText, setCollateralText] = useState('');
  const [collateralFiles, setCollateralFiles] = useState<WorkflowEmailFiles>(
    [],
  );
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

  const persistDraftEdits = useDebouncedCallback(
    async (nextDraftJson: string) => {
      if (!accessToken || !isNonEmptyString(nextDraftJson.trim())) {
        return;
      }

      let senderProfile: Record<string, unknown>;

      try {
        senderProfile = JSON.parse(nextDraftJson) as Record<string, unknown>;
      } catch {
        return;
      }

      try {
        const saved = await saveOutreachSenderProfile({
          accessToken,
          senderProfile: {
            ...senderProfile,
            collateralFiles: collateralFiles.map((file) => ({
              fileId: file.id,
              fileName: file.name,
              mimeType: file.type,
            })),
          },
          senderNotes,
          collateralText,
          linkedinProfileText,
        });

        setSavedSummary(
          summarizeOutreachSenderProfile(saved.outreachSenderProfile),
        );
        setCollateralFiles(
          readCollateralFilesFromProfile(saved.outreachSenderProfile),
        );
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to save sender profile edits.',
        });
      }
    },
    500,
  );

  const handleDraftJsonChange = (nextDraftJson: string) => {
    setDraftJson(nextDraftJson);
    void persistDraftEdits(nextDraftJson);
  };

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
        setCollateralFiles(
          readCollateralFilesFromProfile(seed.existingSenderProfile),
        );
        if (seed.existingSenderProfile) {
          setDraftJson(
            stringifySenderProfileDraft(
              normalizeSenderProfileDraft(seed.existingSenderProfile),
            ),
          );
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

  const handleGenerate = async () => {
    if (!isNonEmptyString(linkedinProfileText.trim())) {
      enqueueErrorSnackBar({
        message: 'Fetch your LinkedIn profile before generating.',
      });
      return;
    }

    setIsDrafting(true);
    try {
      const result = await generateOutreachSenderProfile({
        accessToken,
        senderNotes,
        collateralText,
        linkedinProfileText,
      });
      setDraftJson(
        stringifySenderProfileDraft(normalizeSenderProfileDraft(result.draft)),
      );
      setLinkedinProfileText(result.linkedinProfileText);
      setSavedSummary(summarizeOutreachSenderProfile(result.draft));
      setIsJsonOpen(false);
      enqueueSuccessSnackBar({
        message: 'Sender profile generated and saved to your seat.',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to generate sender profile.',
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
        senderProfile: {
          ...senderProfile,
          collateralFiles: collateralFiles.map((file) => ({
            fileId: file.id,
            fileName: file.name,
            mimeType: file.type,
          })),
        },
        senderNotes,
        collateralText,
        linkedinProfileText,
      });
      setSavedSummary(
        summarizeOutreachSenderProfile(saved.outreachSenderProfile),
      );
      setCollateralFiles(
        readCollateralFilesFromProfile(saved.outreachSenderProfile),
      );
      setDraftJson(
        stringifySenderProfileDraft(
          normalizeSenderProfileDraft(saved.outreachSenderProfile),
        ),
      );
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

  const handleCollateralFilesChange = async (nextFiles: WorkflowEmailFiles) => {
    const previousIds = new Set(collateralFiles.map((file) => file.id));
    const nextIds = new Set(nextFiles.map((file) => file.id));
    const added = nextFiles.filter((file) => !previousIds.has(file.id));
    const removed = collateralFiles.filter((file) => !nextIds.has(file.id));

    setCollateralFiles(nextFiles);

    for (const file of added) {
      try {
        const saved = await appendOutreachSenderCollateralFile({
          accessToken,
          fileId: file.id,
          fileName: file.name,
          mimeType: file.type,
        });
        setCollateralFiles(
          readCollateralFilesFromProfile(saved.outreachSenderProfile),
        );
        enqueueSuccessSnackBar({
          message: `Saved ${file.name} for sending`,
        });
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to save collateral file.',
        });
      }
    }

    for (const file of removed) {
      try {
        const saved = await removeOutreachSenderCollateralFile({
          accessToken,
          fileId: file.id,
        });
        setCollateralFiles(
          readCollateralFilesFromProfile(saved.outreachSenderProfile),
        );
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to remove collateral file.',
        });
      }
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
              Collateral (paste notes; upload decks / PDFs to send)
            </StyledFieldLabel>
            <TextArea
              textAreaId="outreach-setup-sender-collateral"
              minRows={3}
              maxRows={10}
              value={collateralText}
              onChange={setCollateralText}
              placeholder="Paste pitch deck talking points, one-pagers, FAQ…"
            />
            {collateralFiles.length > 0 ? (
              <>
                <StyledFieldLabel>
                  Uploaded files ({collateralFiles.length})
                </StyledFieldLabel>
                <StyledMuted>
                  These stay on your seat for the Send Files agent tool. Remove
                  a chip to delete.
                </StyledMuted>
              </>
            ) : (
              <StyledMuted>
                No files uploaded yet. Add decks / PDFs below — they appear here
                after upload.
              </StyledMuted>
            )}
            <WorkflowSendEmailAttachments
              label={
                collateralFiles.length > 0
                  ? 'Manage attachments'
                  : 'Attachments'
              }
              files={collateralFiles}
              onChange={(nextFiles) => {
                void handleCollateralFilesChange(nextFiles);
              }}
              readonly={!accessToken}
            />
            <StyledMuted>
              PPT / PDF / DOCX are supported for sending.
            </StyledMuted>
          </StyledFieldStack>

          <StyledActions>
            <Button
              title={isDrafting ? 'Generating…' : 'Generate'}
              variant="secondary"
              size="small"
              onClick={() => {
                void handleGenerate();
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
              <StyledFieldLabel>Sender profile</StyledFieldLabel>
              <StyledMuted>
                Edits save to your seat automatically. Use Edit as JSON only if
                you need a raw override.
              </StyledMuted>
              <OutreachSenderProfileDraftEditor
                draftJson={draftJson}
                onChange={handleDraftJsonChange}
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
                  onChange={handleDraftJsonChange}
                />
              )}
            </StyledFieldStack>
          )}
        </>
      )}
    </OutreachSetupSectionCard>
  );
};
