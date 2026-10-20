import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useEffect, useMemo, useState } from 'react';
import {
  OUTREACH_DRAFT_DEFAULT_TEMPLATES,
  OUTREACH_DRAFT_TEMPLATE_KEYS,
  OUTREACH_DRAFT_TEMPLATE_LABELS,
  OUTREACH_DRAFT_VARIABLES,
  renderOutreachDraftTemplate,
  validateOutreachDraftTemplate,
  type OutreachDraftTemplateKey,
  type OutreachDraftTemplateValidation,
  type OutreachDraftTemplateValues,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import { type WorkflowEmailFiles } from 'twenty-shared/workflow';
import { Button, SegmentedControl, type SelectOption } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { WorkflowSendEmailAttachments } from '@/advanced-text-editor/components/WorkflowSendEmailAttachments';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { OutreachDraftTemplateEditor } from '@/outreach-home/components/OutreachDraftTemplateEditor';
import { OutreachSetupSectionCard } from '@/outreach-home/components/OutreachSetupSectionCard';
import { useOutreachWorkflowEmbed } from '@/outreach-home/hooks/useOutreachWorkflowEmbed';
import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';
import {
  fetchOutreachDraftSettings,
  saveOutreachDraftSettings,
  type OutreachDraftSettings,
} from '@/outreach-home/utils/outreach-draft-templates-api';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Select } from '@/ui/input/components/Select';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useApplyOutreachSequencerGraphOptions } from '@/workflow/hooks/useApplyOutreachSequencerGraphOptions';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { inferOutreachSequencerGraphOptionsFromSteps } from '@/workflow/utils/inferOutreachSequencerGraphOptionsFromSteps';

type DraftMode = 'AI' | 'MANUAL';

const SAMPLE_PREVIEW_PERSON_ID = '';

// LinkedIn connection requests cannot carry files.
const TEMPLATE_KEYS_WITHOUT_ATTACHMENTS: OutreachDraftTemplateKey[] = [
  'connectionNote',
];

const SAMPLE_PREVIEW_PERSON_OPTION: SelectOption<string> = {
  label: 'Sample prospect',
  value: SAMPLE_PREVIEW_PERSON_ID,
};

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0;
`;

const StyledFieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPreview = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.6;
  padding: ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
`;

const StyledValidationList = styled.ul<{ isValid: boolean }>`
  color: ${({ isValid }) =>
    isValid ? themeCssVariables.color.green : themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  padding-left: ${themeCssVariables.spacing[4]};
`;

const getPersonOptionLabel = (person: OutreachPersonRow): string => {
  const fullName = person.name.trim();
  const companyName = person.companyName.trim();

  if (!isNonEmptyString(companyName)) {
    return fullName;
  }

  return `${fullName} · ${companyName}`;
};

const buildPreviewValues = ({
  settings,
  person,
}: {
  settings: OutreachDraftSettings;
  person: OutreachPersonRow | undefined;
}): OutreachDraftTemplateValues => {
  const values: OutreachDraftTemplateValues = {};

  for (const variable of OUTREACH_DRAFT_VARIABLES) {
    values[variable.key] = variable.sampleValue;
  }

  // The sender is the real signed-in member; a blank value must surface as missing.
  values['sender.name'] = settings.senderName;
  values['sender.website'] = settings.senderWebsite;

  if (isDefined(person)) {
    const fullName = person.name.trim();

    values['person.firstName'] = fullName.split(/\s+/)[0] ?? '';
    values['person.fullName'] = fullName;
    values['company.name'] = person.companyName.trim();
  }

  return values;
};

const renderPreview = (
  template: string,
  values: OutreachDraftTemplateValues,
): string => {
  const valuesWithMarkers: OutreachDraftTemplateValues = {};

  for (const variable of OUTREACH_DRAFT_VARIABLES) {
    const value = values[variable.key];

    valuesWithMarkers[variable.key] = isNonEmptyString(value?.trim())
      ? value
      : `[${variable.label} missing]`;
  }

  return renderOutreachDraftTemplate(template, valuesWithMarkers).message;
};

type OutreachSetupDraftMessagesSectionProps = {
  people: OutreachPersonRow[];
};

export const OutreachSetupDraftMessagesSection = ({
  people,
}: OutreachSetupDraftMessagesSectionProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const { workflowId } = useOutreachWorkflowEmbed({ enabled: true });
  const workflowWithCurrentVersion = useWorkflowWithCurrentVersion(
    workflowId ?? '',
  );
  const { applyOutreachSequencerGraphOptions } =
    useApplyOutreachSequencerGraphOptions();

  const [settings, setSettings] = useState<OutreachDraftSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<
    Record<OutreachDraftTemplateKey, string>
  >({ ...OUTREACH_DRAFT_DEFAULT_TEMPLATES });
  const [drafts, setDrafts] = useState<
    Record<OutreachDraftTemplateKey, string>
  >({ ...OUTREACH_DRAFT_DEFAULT_TEMPLATES });
  const [editorVersions, setEditorVersions] = useState<
    Partial<Record<OutreachDraftTemplateKey, number>>
  >({});
  const [attachments, setAttachments] = useState<
    Partial<Record<OutreachDraftTemplateKey, WorkflowEmailFiles>>
  >({});
  const [activeKey, setActiveKey] =
    useState<OutreachDraftTemplateKey>('connectionNote');
  const [validations, setValidations] = useState<
    Partial<Record<OutreachDraftTemplateKey, OutreachDraftTemplateValidation>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [previewPersonId, setPreviewPersonId] = useState(
    SAMPLE_PREVIEW_PERSON_ID,
  );

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      try {
        const loaded = await fetchOutreachDraftSettings(accessToken);

        if (isCancelled) {
          return;
        }

        setSettings(loaded);
        setSavedTemplates(loaded.templates);
        setDrafts(loaded.templates);
        setAttachments(loaded.attachments);
      } catch (error) {
        if (!isCancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Failed to load draft messages.',
          );
        }
      }
    };

    if (isDefined(accessToken)) {
      void load();
    }

    return () => {
      isCancelled = true;
    };
  }, [accessToken]);

  const currentOptions = isDefined(workflowWithCurrentVersion)
    ? inferOutreachSequencerGraphOptionsFromSteps(
        // Step settings are a wide union; inference only reads id, type and duration.
        workflowWithCurrentVersion.currentVersion?.steps as Parameters<
          typeof inferOutreachSequencerGraphOptionsFromSteps
        >[0],
        workflowWithCurrentVersion.currentVersion?.trigger,
      )
    : null;
  const mode: DraftMode =
    currentOptions?.manualDraftTemplates === true ? 'MANUAL' : 'AI';
  const previewPersonOptions = useMemo(
    (): SelectOption<string>[] =>
      people
        .filter((person) => isNonEmptyString(person.name.trim()))
        .map((person) => ({
          label: getPersonOptionLabel(person),
          value: person.id,
        })),
    [people],
  );
  const previewPerson = people.find((person) => person.id === previewPersonId);
  const previewValues = isDefined(settings)
    ? buildPreviewValues({ settings, person: previewPerson })
    : {};
  const previewLabel = isDefined(previewPerson)
    ? `Preview (${previewPerson.name.trim()})`
    : 'Preview (sample prospect)';
  const isDirty = drafts[activeKey] !== savedTemplates[activeKey];
  const validation = validations[activeKey];
  const canHaveAttachments =
    !TEMPLATE_KEYS_WITHOUT_ATTACHMENTS.includes(activeKey);

  const handleModeChange = async (nextMode: DraftMode) => {
    if (
      isSwitchingMode ||
      nextMode === mode ||
      !isDefined(workflowId) ||
      !isDefined(currentOptions)
    ) {
      return;
    }

    setIsSwitchingMode(true);

    try {
      await applyOutreachSequencerGraphOptions({
        workflowId,
        ...currentOptions,
        manualDraftTemplates: nextMode === 'MANUAL',
      });
      enqueueSuccessSnackBar({
        message:
          nextMode === 'MANUAL'
            ? 'Standard drafts applied to the workflow draft. Activate the workflow when ready.'
            : 'AI-generated drafts applied to the workflow draft. Activate the workflow when ready.',
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to switch the draft mode.',
      });
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const handleTemplateChange = (template: string) => {
    setDrafts((previous) => ({ ...previous, [activeKey]: template }));
    setValidations((previous) => ({ ...previous, [activeKey]: undefined }));
  };

  const handleValidate = () => {
    setValidations((previous) => ({
      ...previous,
      [activeKey]: validateOutreachDraftTemplate({
        templateKey: activeKey,
        template: drafts[activeKey],
        values: previewValues,
      }),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const saved = await saveOutreachDraftSettings({
        accessToken,
        templates: { [activeKey]: drafts[activeKey] },
      });

      setSettings(saved);
      setSavedTemplates((previous) => ({
        ...previous,
        [activeKey]: saved.templates[activeKey],
      }));
      handleValidate();
      enqueueSuccessSnackBar({
        message: `${OUTREACH_DRAFT_TEMPLATE_LABELS[activeKey]} saved`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to save the draft.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDrafts((previous) => ({
      ...previous,
      [activeKey]: OUTREACH_DRAFT_DEFAULT_TEMPLATES[activeKey],
    }));
    setEditorVersions((previous) => ({
      ...previous,
      [activeKey]: (previous[activeKey] ?? 0) + 1,
    }));
    setValidations((previous) => ({ ...previous, [activeKey]: undefined }));
  };

  const handleAttachmentsChange = async (nextFiles: WorkflowEmailFiles) => {
    const previousFiles = attachments[activeKey] ?? [];
    const nextAttachments = { ...attachments, [activeKey]: nextFiles };

    setAttachments(nextAttachments);

    try {
      const saved = await saveOutreachDraftSettings({
        accessToken,
        attachments: nextAttachments,
      });

      setAttachments(saved.attachments);
    } catch (error) {
      setAttachments({ ...attachments, [activeKey]: previousFiles });
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to save the attachment.',
      });
    }
  };

  return (
    <OutreachSetupSectionCard
      title="Draft messages"
      description="Standard messages for the connection note, first message and three follow-ups. In Manual mode these are sent as written, with no AI draft or approval step."
    >
      {isDefined(loadError) && <StyledMuted>{loadError}</StyledMuted>}

      <StyledFieldStack>
        <StyledFieldLabel>Message source</StyledFieldLabel>
        <SegmentedControl<DraftMode>
          ariaLabel="Message source"
          value={mode}
          onChange={handleModeChange}
          itemWidth="content"
          options={[
            { value: 'AI', label: 'AI-generated', disabled: isSwitchingMode },
            {
              value: 'MANUAL',
              label: 'Standard templates (manual)',
              disabled: isSwitchingMode,
            },
          ]}
        />
        <StyledMuted>
          {mode === 'MANUAL'
            ? 'Manual: the templates below are sent. Switching rebuilds the workflow draft and discards hand-edits; activate it when ready.'
            : 'AI: messages are drafted per prospect. Templates below are saved but not used until you switch to Manual.'}
        </StyledMuted>
      </StyledFieldStack>

      <SegmentedControl<OutreachDraftTemplateKey>
        ariaLabel="Draft message"
        role="tablist"
        value={activeKey}
        onChange={setActiveKey}
        itemWidth="content"
        options={OUTREACH_DRAFT_TEMPLATE_KEYS.map((key) => ({
          value: key,
          label: OUTREACH_DRAFT_TEMPLATE_LABELS[key],
        }))}
      />

      <StyledFieldStack>
        <OutreachDraftTemplateEditor
          key={`${activeKey}-${editorVersions[activeKey] ?? 0}`}
          initialValue={drafts[activeKey]}
          onChange={handleTemplateChange}
          placeholder="Write the message…"
        />

        <StyledActions>
          <Button
            title="Save"
            variant="primary"
            accent="blue"
            size="small"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          />
          <Button
            title="Validate template"
            variant="secondary"
            size="small"
            onClick={handleValidate}
          />
          <Button
            title="Reset to default"
            variant="tertiary"
            size="small"
            onClick={handleReset}
          />
        </StyledActions>

        {isDefined(validation) && (
          <StyledValidationList isValid={validation.isValid}>
            {validation.isValid ? (
              <li>Template is valid.</li>
            ) : (
              validation.errors.map((error) => <li key={error}>{error}</li>)
            )}
          </StyledValidationList>
        )}
      </StyledFieldStack>

      <StyledFieldStack>
        <StyledFieldLabel>Preview as</StyledFieldLabel>
        <Select<string>
          dropdownId="outreach-draft-preview-person-select"
          value={
            isDefined(previewPerson)
              ? previewPersonId
              : SAMPLE_PREVIEW_PERSON_ID
          }
          onChange={setPreviewPersonId}
          options={previewPersonOptions}
          emptyOption={SAMPLE_PREVIEW_PERSON_OPTION}
          fullWidth
          selectSizeVariant="small"
          withSearchInput
          needIconCheck={false}
          disabled={previewPersonOptions.length === 0}
        />
        {previewPersonOptions.length === 0 && (
          <StyledMuted>
            Add people to this project to preview messages with their names and
            companies.
          </StyledMuted>
        )}
        <StyledFieldLabel>{previewLabel}</StyledFieldLabel>
        <StyledPreview>
          {renderPreview(drafts[activeKey], previewValues)}
        </StyledPreview>
      </StyledFieldStack>

      {canHaveAttachments ? (
        <StyledFieldStack>
          <StyledFieldLabel>Attachments</StyledFieldLabel>
          <WorkflowSendEmailAttachments
            label="Attachments"
            files={attachments[activeKey] ?? []}
            onChange={handleAttachmentsChange}
          />
          <StyledMuted>
            Sent with this message to every prospect. Leave empty to send text
            only.
          </StyledMuted>
        </StyledFieldStack>
      ) : (
        <StyledMuted>
          LinkedIn connection requests cannot carry attachments.
        </StyledMuted>
      )}
    </OutreachSetupSectionCard>
  );
};
