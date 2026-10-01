import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useEffect, useState } from 'react';
import { type WorkflowAiAgentOutputValidationCheck } from 'twenty-shared/workflow';
import { IconX } from 'twenty-ui/icon';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useDebouncedCallback } from 'use-debounce';

import { InputLabel } from '@/ui/input/components/InputLabel';

const CHECK_SAVE_DEBOUNCE_MS = 1_500;

type WorkflowAiAgentOutputValidationCheckCardProps = {
  check: WorkflowAiAgentOutputValidationCheck;
  readonly?: boolean;
  onChange: (patch: Partial<WorkflowAiAgentOutputValidationCheck>) => void;
  onRemove: () => void;
};

const StyledCheckCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledCheckHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: space-between;
`;

const StyledCaption = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledTextInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  width: 100%;
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 64px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  resize: vertical;
  width: 100%;
`;

const checkLabel = (check: WorkflowAiAgentOutputValidationCheck): string =>
  check.label.trim() === '' ? 'Untitled check' : check.label;

const checkIsReady = (check: WorkflowAiAgentOutputValidationCheck): boolean =>
  check.instructions.trim() !== '' &&
  check.invalidWhen.trim() !== '' &&
  check.validWhen.trim() !== '';

export const WorkflowAiAgentOutputValidationCheckCard = ({
  check,
  readonly = false,
  onChange,
  onRemove,
}: WorkflowAiAgentOutputValidationCheckCardProps) => {
  const [draft, setDraft] = useState(check);
  const persistDebounced = useDebouncedCallback(
    (next: WorkflowAiAgentOutputValidationCheck) => {
      onChange(next);
    },
    CHECK_SAVE_DEBOUNCE_MS,
  );

  useEffect(() => {
    if (persistDebounced.isPending()) {
      return;
    }

    setDraft(check);
  }, [check, persistDebounced]);

  useEffect(() => {
    return () => {
      persistDebounced.flush();
    };
  }, [persistDebounced]);

  const updateDraft = (
    patch: Partial<WorkflowAiAgentOutputValidationCheck>,
  ) => {
    const next = { ...draft, ...patch };

    setDraft(next);
    persistDebounced(next);
  };

  const flushDraft = () => {
    persistDebounced.flush();
  };

  return (
    <StyledCheckCard>
      <StyledCheckHeader>
        <InputLabel>{checkLabel(draft)}</InputLabel>
        {readonly ? null : (
          <LightIconButton
            Icon={IconX}
            accent="tertiary"
            size="small"
            aria-label={t`Remove check`}
            onClick={() => {
              persistDebounced.cancel();
              onRemove();
            }}
          />
        )}
      </StyledCheckHeader>
      {checkIsReady(draft) ? null : (
        <StyledCaption>
          {t`This check runs after the question, reject when, and allow when are filled in.`}
        </StyledCaption>
      )}
      <StyledCaption>{t`Name`}</StyledCaption>
      <StyledTextInput
        value={draft.label}
        disabled={readonly}
        aria-label={t`Check name`}
        onChange={(event) => updateDraft({ label: event.target.value })}
        onBlur={flushDraft}
      />
      <StyledCaption>{t`Question`}</StyledCaption>
      <StyledTextArea
        value={draft.instructions}
        disabled={readonly}
        aria-label={t`Question`}
        onChange={(event) => updateDraft({ instructions: event.target.value })}
        onBlur={flushDraft}
      />
      <StyledCaption>{t`Reject when`}</StyledCaption>
      <StyledTextArea
        value={draft.invalidWhen}
        disabled={readonly}
        aria-label={t`Reject when`}
        onChange={(event) => updateDraft({ invalidWhen: event.target.value })}
        onBlur={flushDraft}
      />
      <StyledCaption>{t`Allow when`}</StyledCaption>
      <StyledTextArea
        value={draft.validWhen}
        disabled={readonly}
        aria-label={t`Allow when`}
        onChange={(event) => updateDraft({ validWhen: event.target.value })}
        onBlur={flushDraft}
      />
    </StyledCheckCard>
  );
};
