import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachChipTagInput } from '@/outreach-home/components/OutreachChipTagInput';
import {
  parseSenderProfileDraft,
  readSenderDraftBoolean,
  readSenderDraftFaq,
  readSenderDraftNumber,
  readSenderDraftObjections,
  readSenderDraftReviewFlags,
  readSenderDraftString,
  readSenderDraftStringList,
  writeSenderDraftBoolean,
  writeSenderDraftFaq,
  writeSenderDraftNumber,
  writeSenderDraftObjections,
  writeSenderDraftString,
  writeSenderDraftStringList,
  type OutreachSenderFaqDraftItem,
  type OutreachSenderObjectionDraftItem,
} from '@/outreach-home/utils/outreach-sender-profile-draft.util';
import { TextArea } from '@/ui/input/components/TextArea';
import { TextInput } from '@/ui/input/components/TextInput';

const StyledRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
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

const StyledFieldGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const StyledPairList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPairCard = styled.div`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledPairActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const StyledCheckboxRow = styled.label`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  margin: 0;
`;

const StyledFlagList = styled.ul`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  margin: 0;
  padding-left: ${themeCssVariables.spacing[4]};
`;

type OutreachSenderProfileDraftEditorProps = {
  draftJson: string;
  onChange: (nextDraftJson: string) => void;
  disabled?: boolean;
};

type StringField = {
  section: string;
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

const IDENTITY_FIELDS: StringField[] = [
  { section: 'identity', key: 'full_name', label: 'Full name' },
  { section: 'identity', key: 'how_they_sign', label: 'How they sign' },
  { section: 'identity', key: 'title', label: 'Title' },
  { section: 'identity', key: 'company', label: 'Company' },
  { section: 'identity', key: 'city', label: 'City' },
  { section: 'identity', key: 'timezone', label: 'Timezone' },
  { section: 'identity', key: 'email', label: 'Email' },
  { section: 'identity', key: 'phone', label: 'Phone' },
];

const CREDIBILITY_TEXT_FIELDS: StringField[] = [
  {
    section: 'credibility',
    key: 'one_liner',
    label: 'One-liner',
    multiline: true,
  },
  {
    section: 'credibility',
    key: 'operator_line',
    label: 'Operator line',
    multiline: true,
  },
];

const OFFER_TEXT_FIELDS: StringField[] = [
  { section: 'offer', key: 'product_name', label: 'Product name' },
  { section: 'offer', key: 'category', label: 'Category' },
  {
    section: 'offer',
    key: 'one_sentence',
    label: 'One-sentence pitch',
    multiline: true,
  },
  { section: 'offer', key: 'pricing_line', label: 'Pricing line' },
  { section: 'offer', key: 'pilot_offer', label: 'Pilot offer' },
];

const VOICE_TEXT_FIELDS: StringField[] = [
  { section: 'voice', key: 'register', label: 'Register / tone' },
  { section: 'voice', key: 'formality', label: 'Formality' },
  { section: 'voice', key: 'sign_off', label: 'Sign-off' },
];

const StringFieldInput = ({
  draftJson,
  field,
  onChange,
  disabled,
}: {
  draftJson: string;
  field: StringField;
  onChange: (next: string) => void;
  disabled: boolean;
}) => {
  const value = readSenderDraftString(draftJson, field.section, field.key);
  const textAreaId = `sender-draft-${field.section}-${field.key}`;

  return (
    <StyledFieldStack>
      <StyledFieldLabel>{field.label}</StyledFieldLabel>
      {field.multiline === true ? (
        <TextArea
          textAreaId={textAreaId}
          minRows={2}
          maxRows={6}
          value={value}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(next) =>
            onChange(
              writeSenderDraftString(draftJson, field.section, field.key, next),
            )
          }
        />
      ) : (
        <TextInput
          value={value}
          onChange={(next) =>
            onChange(
              writeSenderDraftString(draftJson, field.section, field.key, next),
            )
          }
          placeholder={field.placeholder}
          fullWidth
          disabled={disabled}
        />
      )}
    </StyledFieldStack>
  );
};

const ChipFieldInput = ({
  draftJson,
  section,
  fieldKey,
  label,
  onChange,
  disabled,
}: {
  draftJson: string;
  section: string;
  fieldKey: string;
  label: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) => (
  <StyledFieldStack>
    <StyledFieldLabel>{label}</StyledFieldLabel>
    <OutreachChipTagInput
      values={readSenderDraftStringList(draftJson, section, fieldKey)}
      onChange={(next) =>
        onChange(writeSenderDraftStringList(draftJson, section, fieldKey, next))
      }
      disabled={disabled}
      placeholder={`Add ${label.toLowerCase()}`}
    />
  </StyledFieldStack>
);

export const OutreachSenderProfileDraftEditor = ({
  draftJson,
  onChange,
  disabled = false,
}: OutreachSenderProfileDraftEditorProps) => {
  const canEdit =
    disabled !== true && parseSenderProfileDraft(draftJson) !== null;
  const reviewFlags = readSenderDraftReviewFlags(draftJson);
  const faqItems = readSenderDraftFaq(draftJson);
  const objections = readSenderDraftObjections(draftJson);
  const durationMin = readSenderDraftNumber(
    draftJson,
    'meeting',
    'default_duration_min',
  );

  const updateFaq = (next: OutreachSenderFaqDraftItem[]) => {
    onChange(writeSenderDraftFaq(draftJson, next));
  };

  const updateObjections = (next: OutreachSenderObjectionDraftItem[]) => {
    onChange(writeSenderDraftObjections(draftJson, next));
  };

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
      {/* {reviewFlags.length > 0 && (
        <StyledSection>
          <StyledSectionTitle>Review these inferred fields</StyledSectionTitle>
          <StyledMuted>
            Generated guesses worth a quick pass before saving.
          </StyledMuted>
          <StyledFlagList>
            {reviewFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </StyledFlagList>
        </StyledSection>
      )} */}

      <StyledSection>
        <StyledSectionTitle>Identity</StyledSectionTitle>
        <StyledFieldGrid>
          {IDENTITY_FIELDS.map((field) => (
            <StringFieldInput
              key={`${field.section}.${field.key}`}
              draftJson={draftJson}
              field={field}
              onChange={onChange}
              disabled={disabled}
            />
          ))}
        </StyledFieldGrid>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Credibility</StyledSectionTitle>
        {CREDIBILITY_TEXT_FIELDS.map((field) => (
          <StringFieldInput
            key={`${field.section}.${field.key}`}
            draftJson={draftJson}
            field={field}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
        <ChipFieldInput
          draftJson={draftJson}
          section="credibility"
          fieldKey="credentials"
          label="Credentials"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="credibility"
          fieldKey="industries_known"
          label="Industries known"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="credibility"
          fieldKey="shared_background_tags"
          label="Shared background tags"
          onChange={onChange}
          disabled={disabled}
        />
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Offer</StyledSectionTitle>
        <StyledFieldGrid>
          {OFFER_TEXT_FIELDS.filter((field) => field.multiline !== true).map(
            (field) => (
              <StringFieldInput
                key={`${field.section}.${field.key}`}
                draftJson={draftJson}
                field={field}
                onChange={onChange}
                disabled={disabled}
              />
            ),
          )}
        </StyledFieldGrid>
        {OFFER_TEXT_FIELDS.filter((field) => field.multiline === true).map(
          (field) => (
            <StringFieldInput
              key={`${field.section}.${field.key}`}
              draftJson={draftJson}
              field={field}
              onChange={onChange}
              disabled={disabled}
            />
          ),
        )}
        <ChipFieldInput
          draftJson={draftJson}
          section="offer"
          fieldKey="problem_statements"
          label="Problem statements"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="offer"
          fieldKey="outcomes"
          label="Outcomes"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="offer"
          fieldKey="proof_points"
          label="Proof points"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="offer"
          fieldKey="works_with"
          label="Works with"
          onChange={onChange}
          disabled={disabled}
        />
        <StyledFieldStack>
          <StyledFieldLabel>FAQ</StyledFieldLabel>
          <StyledPairList>
            {faqItems.map((item, index) => (
              <StyledPairCard key={`faq-${index}`}>
                <TextInput
                  value={item.q}
                  onChange={(next) => {
                    const updated = faqItems.map((faqItem, faqIndex) =>
                      faqIndex === index ? { ...faqItem, q: next } : faqItem,
                    );
                    updateFaq(updated);
                  }}
                  placeholder="Question"
                  fullWidth
                  disabled={disabled}
                />
                <TextArea
                  textAreaId={`sender-draft-faq-a-${index}`}
                  minRows={2}
                  maxRows={5}
                  value={item.a}
                  disabled={disabled}
                  placeholder="Answer"
                  onChange={(next) => {
                    const updated = faqItems.map((faqItem, faqIndex) =>
                      faqIndex === index ? { ...faqItem, a: next } : faqItem,
                    );
                    updateFaq(updated);
                  }}
                />
                <StyledPairActions>
                  <Button
                    title="Remove"
                    variant="secondary"
                    size="small"
                    disabled={disabled}
                    onClick={() =>
                      updateFaq(
                        faqItems.filter((_, faqIndex) => faqIndex !== index),
                      )
                    }
                  />
                </StyledPairActions>
              </StyledPairCard>
            ))}
            <Button
              title="Add FAQ"
              variant="secondary"
              size="small"
              disabled={disabled}
              onClick={() => updateFaq([...faqItems, { q: '', a: '' }])}
            />
          </StyledPairList>
        </StyledFieldStack>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>ICP (sender)</StyledSectionTitle>
        <StyledMuted>
          Who you typically sell to — synced with workspace Target titles /
          Locations.
        </StyledMuted>
        <ChipFieldInput
          draftJson={draftJson}
          section="icp"
          fieldKey="target_roles"
          label="Target roles"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="icp"
          fieldKey="geography"
          label="Geography"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="icp"
          fieldKey="exclude_roles"
          label="Exclude roles"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="icp"
          fieldKey="exclude_company_types"
          label="Exclude company types"
          onChange={onChange}
          disabled={disabled}
        />
        <StringFieldInput
          draftJson={draftJson}
          field={{
            section: 'icp',
            key: 'target_company_profile',
            label: 'Target company profile',
            multiline: true,
          }}
          onChange={onChange}
          disabled={disabled}
        />
        <StringFieldInput
          draftJson={draftJson}
          field={{
            section: 'icp',
            key: 'revenue_band',
            label: 'Revenue band',
          }}
          onChange={onChange}
          disabled={disabled}
        />
        <StyledFieldStack>
          <StyledFieldLabel>Known objections</StyledFieldLabel>
          <StyledPairList>
            {objections.map((item, index) => (
              <StyledPairCard key={`objection-${index}`}>
                <TextInput
                  value={item.objection}
                  onChange={(next) => {
                    const updated = objections.map(
                      (objectionItem, objectionIndex) =>
                        objectionIndex === index
                          ? { ...objectionItem, objection: next }
                          : objectionItem,
                    );
                    updateObjections(updated);
                  }}
                  placeholder="Objection"
                  fullWidth
                  disabled={disabled}
                />
                <TextArea
                  textAreaId={`sender-draft-objection-response-${index}`}
                  minRows={2}
                  maxRows={5}
                  value={item.response}
                  disabled={disabled}
                  placeholder="Response"
                  onChange={(next) => {
                    const updated = objections.map(
                      (objectionItem, objectionIndex) =>
                        objectionIndex === index
                          ? { ...objectionItem, response: next }
                          : objectionItem,
                    );
                    updateObjections(updated);
                  }}
                />
                <StyledPairActions>
                  <Button
                    title="Remove"
                    variant="secondary"
                    size="small"
                    disabled={disabled}
                    onClick={() =>
                      updateObjections(
                        objections.filter(
                          (_, objectionIndex) => objectionIndex !== index,
                        ),
                      )
                    }
                  />
                </StyledPairActions>
              </StyledPairCard>
            ))}
            <Button
              title="Add objection"
              variant="secondary"
              size="small"
              disabled={disabled}
              onClick={() =>
                updateObjections([
                  ...objections,
                  { objection: '', response: '' },
                ])
              }
            />
          </StyledPairList>
        </StyledFieldStack>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Voice</StyledSectionTitle>
        <StyledFieldGrid>
          {VOICE_TEXT_FIELDS.map((field) => (
            <StringFieldInput
              key={`${field.section}.${field.key}`}
              draftJson={draftJson}
              field={field}
              onChange={onChange}
              disabled={disabled}
            />
          ))}
        </StyledFieldGrid>
        <StyledCheckboxRow>
          <input
            type="checkbox"
            checked={readSenderDraftBoolean(
              draftJson,
              'voice',
              'uses_honorifics',
            )}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                writeSenderDraftBoolean(
                  draftJson,
                  'voice',
                  'uses_honorifics',
                  event.target.checked,
                ),
              )
            }
          />
          Use honorifics (Mr/Ms)
        </StyledCheckboxRow>
        <ChipFieldInput
          draftJson={draftJson}
          section="voice"
          fieldKey="signature_phrases"
          label="Signature phrases"
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="voice"
          fieldKey="avoid_phrases"
          label="Avoid phrases"
          onChange={onChange}
          disabled={disabled}
        />
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Meeting</StyledSectionTitle>
        <StyledFieldGrid>
          <StringFieldInput
            draftJson={draftJson}
            field={{
              section: 'meeting',
              key: 'platform',
              label: 'Platform',
              placeholder: 'zoom / teams / meet',
            }}
            onChange={onChange}
            disabled={disabled}
          />
          <StyledFieldStack>
            <StyledFieldLabel>Default duration (min)</StyledFieldLabel>
            <TextInput
              value={durationMin === null ? '' : String(durationMin)}
              onChange={(next) => {
                const trimmed = next.trim();
                const parsed =
                  trimmed.length === 0 ? null : Number.parseInt(trimmed, 10);
                onChange(
                  writeSenderDraftNumber(
                    draftJson,
                    'meeting',
                    'default_duration_min',
                    parsed !== null && Number.isFinite(parsed) ? parsed : null,
                  ),
                );
              }}
              placeholder="20"
              fullWidth
              disabled={disabled}
            />
          </StyledFieldStack>
        </StyledFieldGrid>
        <StringFieldInput
          draftJson={draftJson}
          field={{
            section: 'meeting',
            key: 'agenda_template',
            label: 'Agenda template',
            multiline: true,
          }}
          onChange={onChange}
          disabled={disabled}
        />
        <ChipFieldInput
          draftJson={draftJson}
          section="meeting"
          fieldKey="preferred_windows"
          label="Preferred windows"
          onChange={onChange}
          disabled={disabled}
        />
        <StyledCheckboxRow>
          <input
            type="checkbox"
            checked={readSenderDraftBoolean(
              draftJson,
              'meeting',
              'allow_weekends_if_proposed',
            )}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                writeSenderDraftBoolean(
                  draftJson,
                  'meeting',
                  'allow_weekends_if_proposed',
                  event.target.checked,
                ),
              )
            }
          />
          Allow weekends if prospect proposes them
        </StyledCheckboxRow>
      </StyledSection>
    </StyledRoot>
  );
};
