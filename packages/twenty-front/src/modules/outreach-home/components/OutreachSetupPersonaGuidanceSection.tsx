import { styled } from '@linaria/react';
import { useEffect, useState } from 'react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachSetupSectionCard } from '@/outreach-home/components/OutreachSetupSectionCard';
import { TextArea } from '@/ui/input/components/TextArea';

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin: 0;
`;

const StyledActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const PERSONA_GUIDANCE_PLACEHOLDER = [
  'CXOs / Founders: peer tone, lead with margin and growth, no product talk in the opener.',
  'Finance heads (CFO, FP&A): lead with store and channel P&L visibility, ask how they track margin today.',
  'Ops / Retail heads: stock, rent and store performance, practical tone.',
  'Anyone else: keep it generic and ask who owns the topic.',
].join('\n');

type OutreachSetupPersonaGuidanceSectionProps = {
  hasProject: boolean;
  personaGuidance: string;
  isSaving: boolean;
  onSave: (personaGuidance: string) => Promise<void>;
};

export const OutreachSetupPersonaGuidanceSection = ({
  hasProject,
  personaGuidance,
  isSaving,
  onSave,
}: OutreachSetupPersonaGuidanceSectionProps) => {
  const [personaGuidanceDraft, setPersonaGuidanceDraft] =
    useState(personaGuidance);

  useEffect(() => {
    setPersonaGuidanceDraft(personaGuidance);
  }, [personaGuidance]);

  const isDirty = personaGuidanceDraft.trim() !== personaGuidance.trim();

  return (
    <OutreachSetupSectionCard
      title="Message personas"
      description="Describe who you message and how each type of person should be approached. The AI uses this for the connection note, first message and follow-ups."
    >
      <TextArea
        textAreaId="outreach-setup-persona-guidance"
        minRows={5}
        maxRows={16}
        value={personaGuidanceDraft}
        onChange={setPersonaGuidanceDraft}
        placeholder={PERSONA_GUIDANCE_PLACEHOLDER}
        disabled={!hasProject}
      />
      <StyledMuted>
        Give each persona a short name. Qualify tags every prospect with the
        persona that fits, and you can see it in their enrichment. Manual draft
        templates do not use this.
      </StyledMuted>
      <StyledActions>
        <Button
          title={isSaving ? 'Saving…' : 'Save personas'}
          variant="primary"
          size="small"
          onClick={() => {
            void onSave(personaGuidanceDraft.trim());
          }}
          disabled={!hasProject || !isDirty || isSaving}
        />
      </StyledActions>
    </OutreachSetupSectionCard>
  );
};
