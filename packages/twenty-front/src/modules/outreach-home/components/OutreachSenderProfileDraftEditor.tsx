import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachChipTagInput } from '@/outreach-home/components/OutreachChipTagInput';
import {
  parseSenderProfileDraft,
  readSenderDraftBrief,
  readSenderDraftChipList,
  writeSenderDraftBrief,
  writeSenderDraftChipList,
} from '@/outreach-home/utils/outreach-sender-profile-draft.util';
import { TextArea } from '@/ui/input/components/TextArea';

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
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

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  margin: 0;
`;

type OutreachSenderProfileDraftEditorProps = {
  draftJson: string;
  onChange: (nextDraftJson: string) => void;
  disabled?: boolean;
};

export const OutreachSenderProfileDraftEditor = ({
  draftJson,
  onChange,
  disabled = false,
}: OutreachSenderProfileDraftEditorProps) => {
  const canEdit =
    disabled !== true && parseSenderProfileDraft(draftJson) !== null;

  if (!canEdit) {
    return (
      <StyledMuted>
        Draft JSON is invalid — open Edit as JSON to fix it before using the
        form.
      </StyledMuted>
    );
  }

  return (
    <StyledRoot>
      <StyledFieldStack>
        <StyledFieldLabel>Target titles</StyledFieldLabel>
        <StyledMuted>
          Discovery job titles — used when finding people.
        </StyledMuted>
        <OutreachChipTagInput
          values={readSenderDraftChipList(draftJson, 'targetTitles')}
          onChange={(next) =>
            onChange(writeSenderDraftChipList(draftJson, 'targetTitles', next))
          }
          disabled={disabled}
          placeholder="Add target title"
        />
      </StyledFieldStack>

      <StyledFieldStack>
        <StyledFieldLabel>Locations</StyledFieldLabel>
        <StyledMuted>Discovery geos — used when finding people.</StyledMuted>
        <OutreachChipTagInput
          values={readSenderDraftChipList(draftJson, 'locations')}
          onChange={(next) =>
            onChange(writeSenderDraftChipList(draftJson, 'locations', next))
          }
          disabled={disabled}
          placeholder="Add location"
        />
      </StyledFieldStack>

      <StyledFieldStack>
        <StyledFieldLabel>Sender brief (for AI agents)</StyledFieldLabel>
        <StyledMuted>
          Who you are, offer/pitch, voice, FAQ, meeting prefs — freeform
          paragraphs passed into outreach workflow prompts.
        </StyledMuted>
        <TextArea
          textAreaId="sender-draft-brief"
          minRows={8}
          maxRows={24}
          value={readSenderDraftBrief(draftJson)}
          disabled={disabled}
          placeholder="Paste or generate the brief the messaging agent should follow…"
          onChange={(next) => onChange(writeSenderDraftBrief(draftJson, next))}
        />
      </StyledFieldStack>
    </StyledRoot>
  );
};
